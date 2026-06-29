import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="fixed inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-blue-600/15 blur-[100px]" />
      </div>
      <SignUp path="/signup" routing="path" signInUrl="/login" />
    </div>
  );
}
