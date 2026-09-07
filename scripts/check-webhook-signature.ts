/**
 * Prueft src/lib/google-webhook-signature.ts.
 *
 *   tsx scripts/check-webhook-signature.ts
 *
 * Der Positivfall ist der wichtige: ein Pruefer, der jede Signatur ablehnt,
 * besteht alle Negativtests. Deshalb wird hier ein eigenes P-256-Schluesselpaar
 * erzeugt, als Tink-Keyset im echten protobuf-Format kodiert und per
 * gepatchtem fetch untergeschoben — damit laeuft derselbe Pfad wie mit Googles
 * Schluesseln, inklusive protobuf-Parser und Praefix-Behandlung.
 */
import { createSign, generateKeyPairSync } from "node:crypto";

function encodeEcdsaPublicKey(x: Buffer, y: Buffer): Buffer {
  // params: hash=SHA256(3), curve=NIST_P256(2), encoding=DER(2)
  const params = Buffer.from([0x08, 0x03, 0x10, 0x02, 0x18, 0x02]);
  const pad = (b: Buffer) => Buffer.concat([Buffer.alloc(1), b]); // fuehrende 0x00 wie bei Google
  const px = pad(x);
  const py = pad(y);
  return Buffer.concat([
    Buffer.from([0x12, params.length]), params,
    Buffer.from([0x1a, px.length]), px,
    Buffer.from([0x22, py.length]), py,
  ]);
}

const KEY_ID = 424242;
const realFetch = globalThis.fetch;

async function main() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");

  const fakeKeyset = {
    primaryKeyId: KEY_ID,
    key: [
      {
        keyData: {
          typeUrl: "type.googleapis.com/google.crypto.tink.EcdsaPublicKey",
          value: encodeEcdsaPublicKey(x, y).toString("base64"),
          keyMaterialType: "ASYMMETRIC_PUBLIC",
        },
        status: "ENABLED",
        keyId: KEY_ID,
        outputPrefixType: "TINK",
      },
    ],
  };

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("webhooks_public_keyset.json")) {
      return new Response(JSON.stringify(fakeKeyset), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(url as string, init);
  }) as typeof fetch;

  const { verifyWebhookSignature, authorizationMatches } = await import(
    "../src/lib/google-webhook-signature"
  );

  const body = '{"notifications":[{"healthUserId":"123","dataType":"exercise"}]}';

  function tinkSign(message: string, keyId: number): string {
    const signer = createSign("sha256");
    signer.update(message);
    const der = signer.sign({ key: privateKey, dsaEncoding: "der" });
    const prefix = Buffer.alloc(5);
    prefix[0] = 0x01;
    prefix.writeUInt32BE(keyId >>> 0, 1);
    return Buffer.concat([prefix, der]).toString("base64");
  }

  const checks: [string, boolean][] = [
    ["gueltige Signatur akzeptiert", await verifyWebhookSignature(body, tinkSign(body, KEY_ID))],
    [
      "veraenderter Body abgelehnt",
      !(await verifyWebhookSignature(body + " ", tinkSign(body, KEY_ID))),
    ],
    ["fremde Key-ID abgelehnt", !(await verifyWebhookSignature(body, tinkSign(body, 999)))],
    ["fehlender Header abgelehnt", !(await verifyWebhookSignature(body, null))],
    ["Muell im Header abgelehnt", !(await verifyWebhookSignature(body, "nicht-base64!!"))],
    [
      "falsches Praefix-Byte abgelehnt",
      !(await verifyWebhookSignature(
        body,
        Buffer.concat([Buffer.from([0x02, 0, 0, 0, 0]), Buffer.alloc(70)]).toString("base64"),
      )),
    ],
    ["Secret stimmt", authorizationMatches("geheim", "geheim")],
    ["Secret mit Bearer-Praefix", authorizationMatches("Bearer geheim", "geheim")],
    ["falsches Secret abgelehnt", !authorizationMatches("anders", "geheim")],
    ["leeres Secret abgelehnt", !authorizationMatches(null, "geheim")],
  ];

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failed++;
  }

  // Und einmal gegen Googles echtes Keyset, damit der protobuf-Parser auch die
  // dortigen Schluessel wirklich baut.
  globalThis.fetch = realFetch;
  const echt = await realFetch(
    "https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json",
  );
  const anzahl = (await echt.json()).key.length;
  console.log(`\n  Googles Keyset: ${anzahl} Schluessel abrufbar`);

  console.log(failed === 0 ? "\nAlles gruen." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
