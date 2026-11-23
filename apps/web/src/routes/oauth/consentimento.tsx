import { createFileRoute } from '@tanstack/react-router';

import { ConsentimentoOAuth } from '@/features/oauth/ConsentimentoOAuth';

export const Route = createFileRoute('/oauth/consentimento')({ component: ConsentimentoOAuth });
