import { Navigate, createFileRoute } from '@tanstack/react-router';

import { useApp } from '@/features/app';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export const Route = createFileRoute('/onboarding')({ component: Onboarding });

/** Com o sapo já criado, o onboarding não aparece de novo. */
function Onboarding() {
  const { user } = useApp();
  if (user) return <Navigate to="/" replace />;
  return <OnboardingScreen />;
}
