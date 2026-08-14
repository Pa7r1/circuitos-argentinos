import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { RequestError } from './lib/api';
import { RestablecerPage } from './features/auth/RestablecerPage';
import { CircuitPage } from './features/circuit-detail/CircuitPage';
import { PrivacidadPage } from './features/legal/PrivacidadPage';
import { TerminosPage } from './features/legal/TerminosPage';
import { MapPage } from './features/map/MapPage';
import { NoEncontrado } from './features/NoEncontrado';
import './index.css';

// el panel admin no forma parte del uso público: se carga solo al entrar a /admin
const AdminPage = React.lazy(() =>
  import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // los 4xx son respuestas legítimas (el 401 del peaje, un slug que no existe):
      // reintentarlas solo suma demora. Los cortes de red y los 5xx sí se reintentan,
      // porque la API del plan gratuito puede estar despertando.
      retry: (intentos, error) => {
        if (error instanceof RequestError && error.statusCode < 500) return false;
        return intentos < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/circuitos/:slug" element={<CircuitPage />} />
            <Route path="/restablecer" element={<RestablecerPage />} />
            <Route path="/terminos" element={<TerminosPage />} />
            <Route path="/privacidad" element={<PrivacidadPage />} />
            <Route
              path="/admin"
              element={
                <React.Suspense fallback={<div className="p-6 text-center">Cargando…</div>}>
                  <AdminPage />
                </React.Suspense>
              }
            />
            {/*
              Comodín. Sin esta ruta, una dirección inexistente no encontraba nada
              que pintar y la pantalla quedaba en blanco: parecía la app rota y no
              una página que no existe.
            */}
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
