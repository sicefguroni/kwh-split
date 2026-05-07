import { Button } from "@/components/ui/button";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.29h6.45a5.5 5.5 0 0 1-2.39 3.61v2.99h3.86c2.26-2.08 3.57-5.14 3.57-8.62Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-2.99c-1.07.72-2.43 1.15-4.09 1.15-3.14 0-5.8-2.12-6.75-4.97H1.27v3.08A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.25 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.38-2.28V6.64H1.27A12 12 0 0 0 0 12c0 1.93.46 3.76 1.27 5.36l3.98-3.08Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.35.6 4.59 1.79l3.44-3.44C17.95 1.14 15.23 0 12 0A12 12 0 0 0 1.27 6.64l3.98 3.08c.95-2.86 3.61-4.95 6.75-4.95Z"
    />
  </svg>
);

export const startSocialAuth = (
  navigate: (url: string) => void = (url) => window.location.assign(url),
) => {
  navigate("/api/auth/google/start");
};

export function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" fullWidth onClick={() => startSocialAuth()}>
        <GoogleIcon />
        Continue with Google
      </Button>
    </div>
  );
}
