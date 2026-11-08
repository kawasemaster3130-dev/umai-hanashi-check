import { HashRouter, Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Shell } from './components/Layout';
import { ConsentModal } from './components/ConsentModal';
import { useSettings } from './app/hooks';
import { CaseProvider } from './app/CaseContext';
import { Spinner } from './components/ui';
import { Home } from './screens/Home';
import { CaseCardScreen } from './screens/CaseCardScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { ChecklistScreen } from './screens/ChecklistScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SheetScreen } from './screens/SheetScreen';
import { NextScreen } from './screens/NextScreen';
import { PaidScreen, PaidStandalone } from './screens/PaidScreen';
import { GuidesScreen } from './screens/GuidesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { KantanScreen, KantanStart } from './screens/KantanScreen';

function CaseLayout() {
  const { id = '' } = useParams();
  return (
    <CaseProvider
      id={id}
      fallback={(state) =>
        state === 'loading' ? (
          <Spinner />
        ) : (
          <div className="card space-y-2">
            <p>この案件は見つかりません（削除されたか、別の端末のデータです）。</p>
            <Link to="/" className="btn-primary">
              ホームへ
            </Link>
          </div>
        )
      }
    >
      <Outlet />
    </CaseProvider>
  );
}

export default function App() {
  const settings = useSettings();
  return (
    <HashRouter>
      <Shell>
        {settings && !settings.consentedAt && <ConsentModal />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/paid" element={<PaidStandalone />} />
          <Route path="/kantan" element={<KantanStart />} />
          <Route path="/kantan/:id" element={<KantanScreen />} />
          <Route path="/guides" element={<GuidesScreen />} />
          <Route path="/guides/:guideId" element={<GuidesScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/case/:id" element={<CaseLayout />}>
            <Route index element={<Navigate to="card" replace />} />
            <Route path="card" element={<CaseCardScreen />} />
            <Route path="research" element={<ResearchScreen />} />
            <Route path="check" element={<ChecklistScreen />} />
            <Route path="review" element={<ReviewScreen />} />
            <Route path="sheet" element={<SheetScreen />} />
            <Route path="next" element={<NextScreen />} />
            <Route path="paid" element={<PaidScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
