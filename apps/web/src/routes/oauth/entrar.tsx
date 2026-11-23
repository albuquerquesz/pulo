import { createFileRoute } from '@tanstack/react-router';

import { EntrarOAuth } from '@/features/oauth/EntrarOAuth';

export const Route = createFileRoute('/oauth/entrar')({ component: EntrarOAuth });
