import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { getPortraitPath } from "@/lib/portraits";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 });
  }
  const { userId } = await params;
  // Only allow the authenticated user to read their own portrait for now.
  if (userId !== session.user.id) {
    return new NextResponse(null, { status: 403 });
  }
  try {
    const buf = await readFile(getPortraitPath(userId));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
