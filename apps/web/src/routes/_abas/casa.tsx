import { createFileRoute } from '@tanstack/react-router';

import { CasaScreen } from '@/features/casa/CasaScreen';
import { lerVinculoDaCasa } from '@/features/foco/vinculo';

export const Route = createFileRoute('/_abas/casa')({ validateSearch: lerVinculoDaCasa, component: Casa });

function Casa() {
  const vinculo = Route.useSearch();
  const navegar = Route.useNavigate();
  return <CasaScreen vinculo={vinculo} onComecou={() => void navegar({ search: {}, replace: true })} />;
}
