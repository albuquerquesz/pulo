import { createFileRoute } from '@tanstack/react-router';

import { PerfilScreen } from '@/features/perfil/PerfilScreen';

export const Route = createFileRoute('/_abas/perfil')({ component: PerfilScreen });
