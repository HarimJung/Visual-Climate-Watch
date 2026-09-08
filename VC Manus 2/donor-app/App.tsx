import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CountryProfile from "./pages/CountryProfile";
import Compare from "./pages/Compare";
import Learn from "./pages/Learn";
import Sources from "./pages/Sources";
import Report from "./pages/Report";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import Integrations from "./pages/Integrations";
import Query from "./pages/Query";
import Verify from "./pages/Verify";
import Forecast from "./pages/Forecast";
import Policy from "./pages/Policy";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/country/:iso3" component={CountryProfile} />
    <Route path="/compare" component={Compare} />
    <Route path="/learn" component={Learn} />
    <Route path="/sources" component={Sources} />
    <Route path="/report/:iso3" component={Report} />
    <Route path="/admin" component={Admin} />
      <Route path="/account" component={Account} />
      <Route path="/integrations" component={Integrations} />
    <Route path="/query" component={Query} />
    <Route path="/verify" component={Verify} />
    <Route path="/forecast" component={Forecast} />
    <Route path="/policy" component={Policy} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
