'use client';

/**
 * Login Page
 * /login route for user authentication
 */

import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const handleSuccess = () => {
    router.push(returnUrl);
    router.refresh();
  };

  const handleSwitchToRegister = () => {
    const params = returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    router.push(`/register${params}`);
  };

  return (
    <LoginForm
      onSuccess={handleSuccess}
      onSwitchToRegister={handleSwitchToRegister}
    />
  );
}
