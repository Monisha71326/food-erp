import { useEffect, useState } from "react";
import MainLayout from "@/layout/MainLayout/MainLayout.jsx";
import { pageRegistry } from "@/pages/pageRegistry.js";
import GenericModulePage from "@/pages/GenericModulePage/GenericModulePage.jsx";
import LoginPage from "@/pages/Login/LoginPage.jsx";
import RegisterPage from "@/pages/Login/RegisterPage.jsx";
import ConfirmHost from "@/components/ConfirmHost.jsx";
import { ROLES } from "@/data/roleNavigation.js";
import { setSession, loadHub } from "@/data/orderHubStore.js";
import { initAuth, currentUser, logout as endSession } from "@/data/authStore.js";

/* Point the Order Hub data at the logged-in client / manager (locked = hide the "Viewing as" switcher) */
function applySession(u) {
  if (u.role === "client") setSession({ clientId: u.id, locked: true });
  else if (u.role === "manager") setSession({ managerId: u.id, locked: true });
  else setSession({ locked: false });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("");
  const [authView, setAuthView] = useState("login"); // login | register
  const [justRegistered, setJustRegistered] = useState(null); // { username, role } -> prefill Sign in

  // open the browser database, make sure demo accounts exist, then restore a saved session
  useEffect(() => {
    (async () => {
      await initAuth();
      await loadHub();
      const u = currentUser();
      if (u) { applySession(u); setUser(u); setActivePage(ROLES[u.role].home); }
      setReady(true);
    })();
  }, []);

  // goTo("Sidebar Label") from any page (orderHubStore.js) fires "meg:navigate" -> switch page
  useEffect(() => {
    const go = (e) => { if (e.detail) setActivePage(e.detail); };
    window.addEventListener("meg:navigate", go);
    return () => window.removeEventListener("meg:navigate", go);
  }, []);

  const login = async (u) => { await loadHub(); applySession(u); setUser(u); setActivePage(ROLES[u.role].home); };
  const logout = () => { endSession(); setSession({ locked: false }); setUser(null); setAuthView("login"); };

  if (!ready) return null;
  if (!user) {
    return authView === "register"
      ? <RegisterPage onRegistered={(u) => { setJustRegistered({ username: u.username, role: u.role }); setAuthView("login"); }} onBack={() => setAuthView("login")} />
      : <LoginPage onLogin={login} onRegister={() => { setJustRegistered(null); setAuthView("register"); }} prefill={justRegistered} />;
  }

  const Page = pageRegistry[activePage];
  return (
    <>
      <MainLayout activePage={activePage} onNavigate={setActivePage} user={user} role={ROLES[user.role]} onLogout={logout}>
        {Page
          ? <Page key={activePage} onNavigate={setActivePage} />
          : <GenericModulePage key={activePage} title={activePage} />}
      </MainLayout>
      <ConfirmHost />
    </>
  );
}