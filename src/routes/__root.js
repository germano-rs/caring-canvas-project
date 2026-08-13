import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts, useLocation, } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Settings, Map as MapIcon, Table as TableIcon, Layout } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
function NotFoundComponent() {
    return (<div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>);
}
function ErrorComponent({ error, reset }) {
    console.error(error);
    const router = useRouter();
    useEffect(() => {
        reportLovableError(error, { boundary: "tanstack_root_error_component" });
    }, [error]);
    return (<div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => {
            router.invalidate();
            reset();
        }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>);
}
export const Route = createRootRouteWithContext()({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "Monitor de Saúde - Curvelo/MG" },
            { name: "description", content: "Dashboard de eventos de saúde com heatmap em Curvelo, Minas Gerais." },
            { property: "og:title", content: "Monitor de Saúde - Curvelo/MG" },
            { property: "og:description", content: "Dashboard de eventos de saúde com heatmap em Curvelo, Minas Gerais." },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [
            {
                rel: "stylesheet",
                href: appCss,
            },
            { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
        ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
});
function RootShell({ children }) {
    return (<html lang="pt-BR">
      <head>
        <HeadContent />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin=""/>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>);
}
function RootComponent() {
    const { queryClient } = Route.useRouteContext();
    const location = useLocation();
    return (<QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-background">
        {/* Navigation Sidebar */}
        <nav className="w-16 md:w-64 border-r bg-card flex flex-col items-center md:items-stretch py-4">
          <div className="px-4 mb-8 flex items-center gap-2 overflow-hidden">
            <MapIcon className="w-8 h-8 text-primary shrink-0"/>
            <span className="font-bold text-xl hidden md:block truncate">Monitor Saúde</span>
          </div>
          
          <div className="flex-1 px-2 space-y-2">
            <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === "/" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}>
              <LayoutDashboard className="w-5 h-5"/>
              <span className="hidden md:block">Dashboard</span>
            </Link>
            
            <Link to="/config" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === "/config" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}>
              <Settings className="w-5 h-5"/>
              <span className="hidden md:block">Configuração</span>
            </Link>
            
            <Link to="/events" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors \${
                location.pathname === "/events" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}>
              <TableIcon className="w-5 h-5"/>
              <span className="hidden md:block">Registros</span>
            </Link>

            <Link to="/panels" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === "/panels" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}>
              <Layout className="w-5 h-5"/>
              <span className="hidden md:block">Painéis</span>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>);
}
