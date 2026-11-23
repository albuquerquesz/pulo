import { createFileRoute } from '@tanstack/react-router';

import { Redirecionar, useApp } from '@/features/app';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export const Route = createFileRoute('/onboarding')({ component: Onboarding });

/** Com o sapo já criado, o onboarding não aparece de novo. */
function Onboarding() {
  const { fase, user } = useApp();
  if (fase !== 'pronto') return <Redirecionar para="/welcome" />;
  if (user) return <Redirecionar para="/" />;
  return <OnboardingScreen />;
}
