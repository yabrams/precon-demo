'use client';

/**
 * Register Page
 * /register route for new user registration
 */

import { useRouter, useSearchParams } from 'next/navigation';
import RegisterForm from '@/components/RegisterForm';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const handleSuccess = () => {
    // Redirect to login with success message
    const params = returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    router.push(`/login${params}`);
    // Show success message (could use toast in future)
    alert('Account created successfully! Please sign in.');
  };

  const handleSwitchToLogin = () => {
    const params = returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    router.push(`/login${params}`);
  };

  return (
    <RegisterForm
      onSuccess={handleSuccess}
      onSwitchToLogin={handleSwitchToLogin}
    />
  );
}
