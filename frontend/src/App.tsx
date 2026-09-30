import { RouterProvider } from 'react-router-dom';
import { router } from './routes/AppRouter';
import OfflineBanner from './components/OfflineBanner';

export default function App() {
  return (
    <>
      <OfflineBanner />
      <RouterProvider router={router} />
    </>
  );
}
