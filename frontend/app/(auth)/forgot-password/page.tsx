import { PasswordReset } from "@/components/password-reset";

export const metadata = { title: "Reset password" };
export default function ForgotPasswordPage() {
  return <PasswordReset complete={false} />;
}
