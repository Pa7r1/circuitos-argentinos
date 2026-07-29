import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// La limpieza automática de Testing Library depende de los globals de vitest, que
// están apagados a propósito: sin esto, cada test montaría sobre el DOM del anterior.
afterEach(cleanup);
