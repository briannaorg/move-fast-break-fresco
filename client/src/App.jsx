import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './shared/Nav';
import ArriccioLayout from './arriccio/ArriccioLayout';
import SearchView from './arriccio/SearchView';
import LibraryView from './arriccio/LibraryView';
import ProjectsList from './arriccio/ProjectsList';
import SinopiaView from './sinopia/SinopiaView';
import IntonacoPlaceholder from './intonaco/Placeholder';

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/arriccio" replace />} />
          <Route path="/arriccio" element={<ArriccioLayout />}>
            <Route index element={<SearchView />} />
            <Route path="library" element={<LibraryView />} />
            <Route path="projects" element={<ProjectsList />} />
          </Route>
          <Route path="/sinopia/:projectId" element={<SinopiaView />} />
          <Route path="/intonaco/:projectId" element={<IntonacoPlaceholder />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
