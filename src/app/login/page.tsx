import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Polar Self-Connect</h1>
          <p className="text-muted-foreground text-sm">
            Melde dich an, um deine Aktivitäten zu sehen.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
