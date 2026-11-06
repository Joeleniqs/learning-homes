/* Visualizers for "DI Across Languages & Frameworks". Every registered name is prefixed with the slug. */
(() => {
  const esc = Viz.esc;
  const pick = (a) => a[Viz.rand(0, a.length - 1)];

  /* Box-and-arrow graph in SVG. nodes: {id,x,y,title,sub,cls,w,tag}; edges: {u,v,cls,label} */
  function boxGraph(nodes, edges, o = {}) {
    const H = o.h || 46;
    const by = new Map(nodes.map((n) => [n.id, n]));
    nodes.forEach((n) => { n._w = n.w || Math.max(100, Math.round(Math.max(String(n.title).length * 7.4, String(n.sub || "").length * 6.2) + 24)); });
    const top = nodes.some((n) => n.tag) ? 16 : 0;
    const minX = Math.min(...nodes.map((n) => n.x - n._w / 2)) - 6, maxX = Math.max(...nodes.map((n) => n.x + n._w / 2)) + 6;
    const minY = Math.min(...nodes.map((n) => n.y - H / 2)) - 6 - top, maxY = Math.max(...nodes.map((n) => n.y + H / 2)) + 6;
    const clip = (a, b, hw) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.min(hw / Math.max(Math.abs(dx), 1e-9), (H / 2) / Math.max(Math.abs(dy), 1e-9));
      return [a.x + dx * t, a.y + dy * t];
    };
    const E = edges.map((e) => {
      const a = by.get(e.u), b = by.get(e.v);
      if (!a || !b) return "";
      const [x1, y1] = clip(a, b, a._w / 2), [x2r, y2r] = clip(b, a, b._w / 2 + 3);
      const dx = x2r - x1, dy = y2r - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const p = `${x2r},${y2r} ${x2r - ux * 10 - uy * 5},${y2r - uy * 10 + ux * 5} ${x2r - ux * 10 + uy * 5},${y2r - uy * 10 - ux * 5}`;
      const lab = e.label ? `<text class="el" x="${(x1 + x2r) / 2}" y="${(y1 + y2r) / 2 - 5}" text-anchor="middle">${esc(e.label)}</text>` : "";
      return `<path class="e ${e.cls || ""}" d="M${x1},${y1} L${x2r},${y2r}"/><polygon class="ah ${e.cls || ""}" points="${p}"/>${lab}`;
    }).join("");
    const N = nodes.map((n) => `<g class="bn ${n.cls || ""}" transform="translate(${n.x},${n.y})">
      <rect x="${-n._w / 2}" y="${-H / 2}" width="${n._w}" height="${H}" rx="8"/>
      <text class="t" y="${n.sub ? -4 : 4}" text-anchor="middle">${esc(n.title)}</text>
      ${n.sub ? `<text class="s" y="13" text-anchor="middle">${esc(n.sub)}</text>` : ""}
      ${n.tag ? `<text class="tg" y="${-H / 2 - 5}" text-anchor="middle">${esc(n.tag)}</text>` : ""}</g>`).join("");
    const vw = maxX - minX, vh = maxY - minY;
    return `<svg class="dal-g" viewBox="${minX} ${minY} ${vw} ${vh}" width="${Math.round(vw * (o.scale || 1))}" role="img" aria-label="${esc(o.label || "dependency graph")}">${E}${N}</svg>`;
  }

  /* =====================================================================
   * 1. When does a wiring mistake surface?
   * ===================================================================== */
  const PHASES = ["compile / codegen", "startup", "first use", "never (silent)", "cannot happen"];
  const PHASE_CLS = ["done", "done", "active", "bad", "path"];
  const ECOS = [
    ["net", ".NET MS.DI", "production defaults"],
    ["netv", ".NET MS.DI", "ValidateOnBuild + ValidateScopes"],
    ["spring", "Spring Boot", "reflection, eager singletons"],
    ["guice", "Guice", "reflection, modules"],
    ["dagger", "Dagger / Hilt", "annotation processor"],
    ["gomanual", "Go, manual", "plain code in main()"],
    ["wire", "Go, Wire", "code generator"],
    ["fx", "Go, Fx", "reflection at startup"],
    ["fastapi", "FastAPI Depends", "signature introspection"],
    ["nest", "NestJS", "decorator metadata, eager"],
    ["inversify", "InversifyJS", "decorator metadata, lazy"],
  ];
  const MISTAKES = {
    "missing registration": {
      code: "OrderService needs PaymentGateway, but nobody registered/provided one.",
      net: [2, "InvalidOperationException: Unable to resolve service for type 'IPaymentGateway' while attempting to activate 'OrderService'.", "Thrown by the first request that needs OrderService. Validation is on by default only in Development."],
      netv: [1, "AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: OrderService Lifetime: Scoped ImplementationType: OrderService': Unable to resolve service for type 'IPaymentGateway' while attempting to activate 'OrderService'.)", "ValidateOnBuild builds a call site for every registration while the host starts."],
      spring: [1, "UnsatisfiedDependencyException: Error creating bean with name 'orderService': … No qualifying bean of type 'PaymentGateway' available: expected at least 1 bean which qualifies as autowire candidate.", "Singletons are created eagerly when the context refreshes. @Lazy and prototype beans move the failure to first use."],
      guice: [1, "CreationException: [Guice/MissingImplementation]: No implementation for PaymentGateway was bound.", "Guice.createInjector() validates every explicit binding and its dependencies."],
      dagger: [0, "error: [Dagger/MissingBinding] PaymentGateway cannot be provided without an @Provides-annotated method.", "The annotation processor sees the whole graph of each @Component while javac runs."],
      gomanual: [0, "not enough arguments in call to orders.NewService\n\thave (*postgres.OrderRepository, func() time.Time)\n\twant (orders.Repository, orders.PaymentGateway, func() time.Time)", "Wiring is ordinary code, so the compiler checks it."],
      wire: [0, "wire: inject InitializeServer: no provider found for orders.PaymentGateway\n\tneeded by *orders.Service in provider \"NewService\"", "The wire tool fails while generating wire_gen.go, before go build."],
      fx: [1, "fx.New: missing dependencies for function \"orders\".NewService: missing type: orders.PaymentGateway", "Only if something reachable from an fx.Invoke needs it: Fx never builds (or checks) providers that nobody asks for."],
      fastapi: [1, "NameError: name 'get_payments' is not defined", "Depends(get_payments) references a function, not a registration, so all you can forget is the import. It fails at import; pyright or mypy flag it in the editor."],
      nest: [1, "Nest can't resolve dependencies of the OrderService (OrderRepository, ?, CLOCK). Please make sure that the argument PaymentGateway at index [1] is available in the OrdersModule context.", "NestFactory.create() instantiates every provider of every module during bootstrap."],
      inversify: [2, "Error: No matching bindings found for serviceIdentifier: Symbol(PaymentGateway)", "container.get() resolves lazily; nothing walks the graph earlier unless you write a test that does."],
    },
    "captive dependency": {
      code: "A long-lived (singleton) service depends on a short-lived (per-request) one.",
      net: [3, "No error. The singleton keeps the first request's DbContext for the life of the process.", "ValidateScopes is off outside Development, so the root provider silently creates the 'scoped' instance and keeps it."],
      netv: [1, "Cannot consume scoped service 'AppDbContext' from singleton 'PriceCache'.", "ValidateScopes/ValidateOnBuild walk every chain. Details in Lifetimes, Scopes & Captive Dependencies."],
      spring: [3, "No error for a prototype bean injected into a singleton: it is created once and kept.", "@RequestScope and @SessionScope beans are injected as scoped proxies by default, so that case is safe. The prototype is the trap: inject ObjectProvider<T>."],
      guice: [3, "No error if the singleton is built inside a request; OutOfScopeException only if it happens to be built outside one.", "Guice does not compare scopes. Inject Provider<T> to look the scoped value up on every call."],
      dagger: [0, "error: [Dagger/IncompatiblyScopedBindings] AppComponent scoped with @Singleton may not reference bindings with different scopes: @RequestScoped class RequestContext", "Scopes belong to components; a shorter-scoped binding must live in a subcomponent."],
      gomanual: [4, "Not expressible by accident.", "Per-request values are created in the handler. A struct built in main() only gets one if you write that line, where every reviewer can see it."],
      wire: [4, "Wire has no scopes.", "An injector builds its graph once per call; per-request data is passed in as an argument."],
      fx: [4, "Fx has no scopes.", "Every provided value is built once per app. Per-request state travels in context.Context or function arguments."],
      fastapi: [4, "Depends has no singleton lifetime to capture into.", "Request dependencies are cached per request; app-wide objects live at module level or in lifespan state and cannot receive Depends values."],
      nest: [4, "Prevented by scope bubbling.", "Injecting a REQUEST-scoped provider makes every consumer up the chain request-scoped too (at a per-request construction cost)."],
      inversify: [3, "No error: a transient or request-scoped binding injected into a singleton is created once.", "inRequestScope() means 'once per container.get() call', not per HTTP request."],
    },
    "circular dependency": {
      code: "OrderService needs InvoiceService, which needs OrderService.",
      net: [2, "InvalidOperationException: A circular dependency was detected for the service of type 'OrderService'.\nOrderService -> InvoiceService -> OrderService", "On the first resolution of either service."],
      netv: [1, "AggregateException: Some services are not able to be constructed (… A circular dependency was detected for the service of type 'OrderService'. OrderService -> InvoiceService -> OrderService)", "ValidateOnBuild finds it while the host starts."],
      spring: [1, "The dependencies of some of the beans in the application context form a cycle:\n┌─────┐\n|  orderService\n↑     ↓\n|  invoiceService\n└─────┘", "Spring Boot 2.6+ refuses circular references by default (spring.main.allow-circular-references=false)."],
      guice: [3, "No error: Guice breaks the cycle with a circular proxy when the type is an interface.", "Call binder().disableCircularProxies() to turn the cycle into a CreationException."],
      dagger: [0, "error: [Dagger/DependencyCycle] Found a dependency cycle: OrderService → InvoiceService → OrderService", "Break one edge with Provider<T> or Lazy<T>, or better, redesign."],
      gomanual: [0, "undefined: invoices", "You cannot pass a value you have not built yet, so a constructor cycle cannot even be written."],
      wire: [0, "wire: cycle for *orders.Service:\n*orders.Service (orders.NewService) ->\n*invoices.Service (invoices.NewService) ->\n*orders.Service", "Detected while generating."],
      fx: [1, "fx.New: cycle detected in dependency graph: *orders.Service -> *invoices.Service -> *orders.Service", "dig rejects the cycle when the providers are registered."],
      fastapi: [1, "RecursionError: maximum recursion depth exceeded", "FastAPI analyses dependency signatures when the route is registered, at import time, and a cycle recurses forever."],
      nest: [1, "Nest can't resolve dependencies of the OrderService (?). Please make sure that the argument dependency at index [0] is available in the OrdersModule context.", "The '?' usually means a circular file import: the class was still undefined when the decorator ran. forwardRef(() => InvoiceService) on both sides is the escape hatch."],
      inversify: [2, "Error: Circular dependency found: Symbol(OrderService) --> Symbol(InvoiceService) --> Symbol(OrderService)", "On container.get()."],
    },
    "two implementations": {
      code: "EmailNotifier and SmsNotifier are both registered as Notifier; OrderService asks for one Notifier.",
      net: [3, "No error: the last registration wins (SmsNotifier).", "GetService<T> returns the last descriptor; IEnumerable<T> returns all of them. The order of Add calls is semantic."],
      netv: [3, "Still no error: validation does not look for duplicates.", "Make the choice explicit: keyed services, IEnumerable<T>, or one registration."],
      spring: [1, "NoUniqueBeanDefinitionException: No qualifying bean of type 'Notifier' available: expected single matching bean but found 2: emailNotifier,smsNotifier", "Unless one is @Primary, a @Qualifier is used, or the parameter name matches a bean name (a quiet fallback)."],
      guice: [1, "CreationException: [Guice/BindingAlreadySet]: Notifier was bound multiple times.", "One key, one binding. Use @Named or a Multibinder for several."],
      dagger: [0, "error: [Dagger/DuplicateBindings] Notifier is bound multiple times", "Use qualifiers, or @IntoSet / @IntoMap multibindings."],
      gomanual: [4, "You pass exactly one value.", "The choice is a visible line in main()."],
      wire: [0, "wire: multiple bindings for orders.Notifier", "Wire needs exactly one provider per type. Declare distinct types (type SMSNotifier Notifier) to have two."],
      fx: [1, "fx.New: cannot provide function \"sms\".NewNotifier: orders.Notifier already provided by \"email\".NewNotifier", "Use fx.ResultTags(`name:\"sms\"`) or a value group for several."],
      fastapi: [4, "You reference one function.", "Depends(get_email_notifier) is explicit by construction."],
      nest: [3, "No error: the later provider with the same token replaces the earlier one in that module.", "Use a distinct token (a symbol or an abstract class) per implementation."],
      inversify: [2, "Error: Ambiguous match found for serviceIdentifier: Symbol(Notifier)", "Use whenTargetNamed()/whenTargetTagged(), or getAll()."],
    },
  };
  Viz.register("di-across-languages-surface", (host) => Viz.player(host, {
    title: "One wiring mistake, eleven DI tools: when do you find out?",
    tag: "FAIL FAST · STEP THROUGH",
    legend: [["done", "caught before traffic"], ["active", "caught by a request"], ["bad", "silent bug"], ["path", "cannot happen by design"]],
    code: [
      "edit → compile / codegen   # Dagger, Wire, Go, javac, tsc",
      "     → start the app       # Spring, Guice, Nest, Fx, validated MS.DI",
      "     → first request       # MS.DI defaults, Inversify, tsyringe",
      "     → production data     # nothing ever throws",
      "     → (design prevents it)",
    ],
    codeLang: "python",
    inputs: [{ key: "m", label: "the mistake", type: "select", options: Object.keys(MISTAKES), value: "missing registration" }],
    random: () => ({ m: pick(Object.keys(MISTAKES)) }),
    build: ({ m }) => {
      const M = MISTAKES[m];
      if (!M) throw new Error("Pick one of the listed mistakes.");
      const fr = [];
      const caught = () => ECOS.filter(([k]) => M[k][0] <= -1).length;
      fr.push({ phase: -1, m, line: [], note: `<b>${esc(M.code)}</b> Every tool on the left eventually reports this, or doesn't. The further right the dot lands, the more expensive the bug: compile errors cost seconds, startup errors cost a failed deploy, first-use errors cost a failed request, silent bugs cost an incident.`, vars: { mistake: m, phase: "-" } });
      for (let p = 0; p < PHASES.length; p++) {
        const here = ECOS.filter(([k]) => M[k][0] === p);
        const why = [
          "These tools build or check the graph before any binary exists. The reason is the same everywhere: the wiring is either code you wrote (Go) or code a generator wrote (Dagger, Wire), so the type checker sees it.",
          "These tools build or validate the whole graph while the process starts, by reflection. A broken graph fails the deployment's health check, before customers see it.",
          "These tools resolve lazily: the graph is only walked when something asks for this service. The first unlucky request pays.",
          "Nothing throws. The program runs with the wrong object, and you find out from data or behaviour.",
          "The tool has no concept that could express this mistake, so the question does not arise.",
        ][p];
        fr.push({ phase: p, m, line: p, note: `<b>${esc(PHASES[p])}:</b> ${here.length ? here.map(([, n, s]) => `${esc(n)}${s.startsWith("Valid") ? " (validated)" : ""}`).join(", ") : "none of the tools"}. ${why}`, vars: { mistake: m, phase: PHASES[p], "caught here": here.length } });
      }
      const early = ECOS.filter(([k]) => M[k][0] <= 1).length, silent = ECOS.filter(([k]) => M[k][0] === 3).length;
      fr.push({ phase: 9, m, line: [0, 1], note: `<b>Summary:</b> ${early} of ${ECOS.length} catch it before any traffic; ${silent} let it through silently. Compare the two .NET rows: the same container, one option apart. Whatever your stack, turn on the earliest check it offers and add one test that builds the whole graph.`, vars: { mistake: m, "before traffic": early, silent } });
      void caught;
      return fr;
    },
    render: (f) => {
      const M = MISTAKES[f.m];
      const head = `<div class="dal-sr dal-sh"><span>tool</span>${PHASES.map((p, i) => `<span class="${i === f.phase ? "cur" : ""}">${esc(p)}</span>`).join("")}</div>`;
      const rows = ECOS.map(([k, n, s]) => {
        const ph = M[k][0], shown = f.phase === 9 || ph <= f.phase;
        return `<div class="dal-sr ${shown && ph === f.phase ? "hit" : ""}"><span class="dal-sn"><b>${esc(n)}</b><small>${esc(s)}</small></span>${PHASES.map((_, i) => `<span class="dal-sc ${i === f.phase ? "cur" : ""}">${i === ph && shown ? `<i class="dal-dot ${PHASE_CLS[i]}"></i>` : ""}</span>`).join("")}</div>`;
      }).join("");
      const msgs = f.phase >= 0 && f.phase < 9 ? ECOS.filter(([k]) => M[k][0] === f.phase) : [];
      const panel = msgs.length ? `<div class="dal-msgs">${msgs.map(([k, n, s]) => `<div class="dal-msg ${PHASE_CLS[f.phase]}"><b>${esc(n)}${k === "netv" ? " (validated)" : ""}</b><pre>${esc(M[k][1])}</pre><small>${esc(M[k][2])}</small></div>`).join("")}</div>` : "";
      return `<div class="dal-surface">${head}${rows}</div>${panel}`;
    },
  }));

  /* =====================================================================
   * 2. Registration → resolution, per ecosystem
   * ===================================================================== */
  const APP_EDGES = [["H", "S"], ["S", "R"], ["S", "G"], ["S", "K"], ["R", "D"], ["G", "C"]];
  const DEPS = { H: ["S"], S: ["R", "G", "K"], R: ["D"], G: ["C"], D: [], C: [], K: [] };
  const POS = { H: [90, 140], S: [285, 140], R: [500, 50], G: [500, 140], K: [500, 230], D: [730, 50], C: [730, 140] };
  const ORDER = ["H", "S", "R", "D", "G", "C", "K"];
  const LIFE_LABEL = { app: "app-wide", request: "per request", call: "per injection" };
  const ECO = {
    ".NET (MS.DI)": {
      eager: false, disposeNote: "the request scope disposes AppDbContext",
      mech: "MS.DI reflects over the public constructor once, builds a call-site tree, interprets it for the first two resolutions, then swaps in a compiled delegate",
      n: {
        H: ["OrdersController", "request", "AddControllers()  // activated per request"],
        S: ["OrderService", "request", "AddScoped<OrderService>()"],
        R: ["SqlOrderRepository", "request", "AddScoped<IOrderRepository, SqlOrderRepository>()"],
        D: ["AppDbContext", "request", "AddDbContext<AppDbContext>(o => o.UseNpgsql(cs))", true],
        G: ["StripeGateway", "call", "AddHttpClient<IPaymentGateway, StripeGateway>()  // typed client: transient"],
        C: ["HttpClient", "call", "IHttpClientFactory: new HttpClient, pooled handler"],
        K: ["TimeProvider.System", "app", "AddSingleton(TimeProvider.System)"],
      },
    },
    "Spring Boot": {
      eager: true, disposeNote: "nothing is per request: every bean here is a singleton; the transaction, not the bean, is per request",
      mech: "Spring reads the bean definition, reflects over the single constructor and calls it; dependencies are created first, recursively",
      n: {
        H: ["OrderController", "app", "@RestController  (found by component scan)"],
        S: ["OrderService", "app", "@Service  (component scan)"],
        R: ["JdbcOrderRepository", "app", "@Repository  (component scan)"],
        D: ["JdbcClient", "app", "auto-configured by Spring Boot (DataSource pool)"],
        G: ["StripePaymentGateway", "app", "@Component  (component scan)"],
        C: ["RestClient.Builder", "call", "auto-configured, @Scope(\"prototype\")"],
        K: ["Clock", "app", "@Bean Clock clock() in a @Configuration class"],
      },
    },
    "Dagger": {
      eager: false, disposeNote: "the request subcomponent is dropped; Dagger has no disposal, so DbSession is closed by your code",
      mech: "the generated DaggerAppComponent calls the constructor directly (no reflection); scoped bindings are wrapped in DoubleCheck",
      n: {
        H: ["OrderHandler", "request", "@Inject constructor, in RequestComponent"],
        S: ["OrderService", "call", "@Inject constructor (unscoped)"],
        R: ["SqlOrderRepository", "call", "@Binds OrderRepository bind(SqlOrderRepository r)"],
        D: ["DbSession", "request", "@Provides @RequestScoped in RequestModule", true],
        G: ["StripeGateway", "call", "@Binds PaymentGateway bind(StripeGateway g)"],
        C: ["OkHttpClient", "app", "@Provides @Singleton in NetworkModule"],
        K: ["Clock", "app", "@Provides @Singleton Clock clock()"],
      },
    },
    "Go (manual)": {
      eager: true, disposeNote: "nothing per request is built by the wiring: the handler opens a transaction inside the call",
      mech: "you call the constructor yourself in main(), in dependency order; the compiler checks every argument",
      n: {
        H: ["orders.Handler", "app", "h := orders.NewHandler(svc)"],
        S: ["*orders.Service", "app", "svc := orders.NewService(repo, gw, time.Now)"],
        R: ["*postgres.Repo", "app", "repo := postgres.NewOrderRepository(db)"],
        D: ["*sql.DB (pool)", "app", "db, err := sql.Open(\"pgx\", dsn)", true],
        G: ["*stripe.Gateway", "app", "gw := stripe.NewGateway(httpClient, key)"],
        C: ["*http.Client", "app", "httpClient := &http.Client{Timeout: 10 * time.Second}"],
        K: ["time.Now", "app", "a func() time.Time value; nothing to build"],
      },
    },
    "Go (Fx)": {
      eager: true, disposeNote: "nothing per request: Fx values are app-wide; OnStop hooks close the pool at shutdown",
      mech: "dig reflects over the constructor function's parameter and result types, calls it once and caches the result",
      n: {
        H: ["orders.Handler", "app", "fx.Provide(orders.NewHandler) + fx.Invoke(registerRoutes)"],
        S: ["*orders.Service", "app", "fx.Provide(orders.NewService)"],
        R: ["*postgres.Repo", "app", "fx.Provide(fx.Annotate(postgres.NewOrderRepository, fx.As(new(orders.Repository))))"],
        D: ["*sql.DB (pool)", "app", "fx.Provide(openDB)  // appends OnStart/OnStop hooks", true],
        G: ["*stripe.Gateway", "app", "fx.Provide(fx.Annotate(stripe.NewGateway, fx.As(new(orders.PaymentGateway))))"],
        C: ["*http.Client", "app", "fx.Provide(newHTTPClient)"],
        K: ["func() time.Time", "app", "fx.Supply(time.Now)"],
      },
    },
    "FastAPI": {
      eager: true, disposeNote: "the yield dependency get_session runs its cleanup: commit/rollback, close",
      mech: "FastAPI inspected the function signatures for Depends(...) at import; per request it calls each dependency once and caches the result for that request",
      n: {
        H: ["place_order()", "request", "@app.post(\"/orders\") endpoint"],
        S: ["get_order_service()", "request", "Depends(get_order_service)"],
        R: ["get_repo()", "request", "Depends(get_repo)"],
        D: ["get_session() (yield)", "request", "Depends(get_session): yield Session(engine)", true],
        G: ["get_payments()", "request", "Depends(get_payments)"],
        C: ["httpx.Client", "app", "module level: http = httpx.Client(...)"],
        K: ["utc_now", "app", "module-level function: no construction"],
      },
    },
    "NestJS": {
      eager: true, disposeNote: "nothing per request: default-scoped providers are singletons created at bootstrap",
      mech: "Nest reads the design:paramtypes metadata the TypeScript compiler emitted (plus @Inject tokens) and calls new with the resolved instances",
      n: {
        H: ["OrdersController", "app", "@Module({ controllers: [OrdersController] })"],
        S: ["OrderService", "app", "providers: [OrderService]"],
        R: ["PgOrderRepository", "app", "{ provide: OrderRepository, useClass: PgOrderRepository }"],
        D: ["pg.Pool", "app", "{ provide: PG_POOL, useFactory: () => new Pool(cfg) }", true],
        G: ["StripePaymentGateway", "app", "{ provide: PaymentGateway, useClass: StripePaymentGateway }"],
        C: ["HttpService", "app", "imports: [HttpModule]  (exported provider)"],
        K: ["() => new Date()", "app", "{ provide: CLOCK, useValue: () => new Date() }"],
      },
    },
    "InversifyJS": {
      eager: false, disposeNote: "Inversify does not track or dispose instances; transients are left to the GC",
      mech: "Inversify looks up the binding for the service identifier, reads @inject tokens / design:paramtypes, and builds a resolution tree on every container.get()",
      n: {
        H: ["OrdersController", "call", "bind(OrdersController).toSelf()  // transient by default"],
        S: ["OrderService", "call", "bind(TYPES.OrderService).to(OrderService)"],
        R: ["PgOrderRepository", "call", "bind(TYPES.OrderRepository).to(PgOrderRepository)"],
        D: ["pg.Pool", "app", "bind(TYPES.Pool).toConstantValue(new Pool(cfg))"],
        G: ["StripePaymentGateway", "call", "bind(TYPES.PaymentGateway).to(StripePaymentGateway)"],
        C: ["HttpClient", "app", "bind(TYPES.Http).to(FetchHttp).inSingletonScope()"],
        K: ["() => new Date()", "app", "bind(TYPES.Clock).toConstantValue(() => new Date())"],
      },
    },
  };
  Viz.register("di-across-languages-resolve", (host) => Viz.player(host, {
    title: "The same OrderService graph, wired by eight different tools",
    tag: "REGISTER → RESOLVE · STEP THROUGH",
    legend: [["active", "being built now"], ["done", "instance exists"], ["path", "reused from a cache"], ["dim", "not built yet"]],
    code: [
      "register(all recipes)            // scan, @Bean, providers, Add*",
      "if eager: build every app-wide node at startup",
      "for each request:",
      "  resolve(handler):",
      "    if cached for its lifetime: reuse",
      "    else: resolve(deps) first, then construct",
      "  end of request: dispose per-request instances (newest first)",
    ],
    codeLang: "python",
    inputs: [
      { key: "eco", label: "tool", type: "select", options: Object.keys(ECO), value: ".NET (MS.DI)" },
      { key: "reqs", label: "requests (1–3)", value: "2", width: 70 },
    ],
    random: () => ({ eco: pick(Object.keys(ECO)), reqs: String(Viz.rand(1, 3)) }),
    build: ({ eco, reqs }) => {
      const E = ECO[eco];
      if (!E) throw new Error("Pick a tool from the list.");
      const nReq = Viz.parse.int(reqs, { min: 1, max: 3 });
      const fr = [], inst = {}, root = {}, owner = {};
      let nextId = 1, created = 0, reqCache = null, reqNo = 0, reqDisp = [];
      ORDER.forEach((k) => { inst[k] = []; });
      const life = (k) => E.n[k][1];
      const snap = (line, note, extra = {}) => fr.push({ eco, line, note, inst: JSON.parse(JSON.stringify(inst)), cur: extra.cur || null, st: extra.st || {}, regCur: extra.reg ?? null, reqNo, vars: { request: reqNo || "startup", instances: created, ...(extra.vars || {}) } });
      snap(0, `<b>${esc(eco)}: registration.</b> Before anything is built, the tool collects one recipe per node (the table below). ${E.eager ? "This tool builds app-wide objects up front, so a broken recipe fails at startup." : "This tool builds nothing yet: it creates objects lazily, the first time something asks."}`);
      const build = (k, why) => {
        const L = life(k);
        if (L === "app" && root[k]) { snap(4, `<b>${esc(E.n[k][0])}</b> is app-wide and already built (#${root[k]}): ${why} gets the same instance.`, { cur: k, st: { [k]: "path" }, reg: k }); return root[k]; }
        if (L === "request" && reqCache && reqCache[k]) { snap(4, `<b>${esc(E.n[k][0])}</b> is per request and this request already has #${reqCache[k]}: reused, so everyone in request ${reqNo} shares it.`, { cur: k, st: { [k]: "path" }, reg: k }); return reqCache[k]; }
        snap(5, `Need <b>${esc(E.n[k][0])}</b> (${LIFE_LABEL[L]}) for ${why}. ${DEPS[k].length ? `First its dependencies: ${DEPS[k].map((d) => esc(E.n[d][0])).join(", ")}.` : "It has no dependencies."}`, { cur: k, st: { [k]: "active" }, reg: k });
        DEPS[k].forEach((d) => build(d, E.n[k][0]));
        const id = nextId++; created++;
        inst[k].push({ id, req: L === "app" ? 0 : reqNo });
        if (L === "app") root[k] = id; else if (L === "request" && reqCache) reqCache[k] = id;
        if (E.n[k][3] && L === "request") reqDisp.push([k, id]);
        owner[id] = L;
        snap(5, `Construct <b>${esc(E.n[k][0])}</b> #${id}: ${esc(E.mech)}. ${L === "app" ? "Cached for the life of the app." : L === "request" ? `Cached for request ${reqNo}.` : "Not cached: the next consumer gets a new one."}`, { cur: k, st: { [k]: "active" }, reg: k });
        return id;
      };
      if (E.eager) {
        const appNodes = ORDER.filter((k) => life(k) === "app");
        snap(1, `<b>Startup.</b> ${eco === "FastAPI" ? "Importing the module creates the module-level objects" : eco.startsWith("Go") ? "main() (or fx.New) builds the app-wide graph" : "The container builds every singleton now"}: ${appNodes.map((k) => esc(E.n[k][0])).join(", ")}.`);
        appNodes.forEach((k) => { if (!root[k]) build(k, "startup"); });
      }
      for (let r = 1; r <= nReq; r++) {
        reqNo = r; reqCache = {}; reqDisp = [];
        snap(2, `<b>Request ${r} arrives.</b> ${E.eager && ORDER.every((k) => life(k) === "app") ? "Everything is already built, so the request only borrows the handler." : "The handler and its per-request dependencies are resolved now."}`);
        build("H", `request ${r}`);
        snap(6, `<b>Request ${r} ends:</b> ${esc(E.disposeNote)}${reqDisp.length ? ` (${reqDisp.slice().reverse().map(([k, id]) => `${esc(E.n[k][0])} #${id}`).join(", ")})` : ""}.`, { vars: { "built this request": Object.keys(reqCache).length } });
        reqCache = null;
      }
      const per = ORDER.filter((k) => life(k) !== "app").length;
      snap(6, `<b>Total: ${created} instances</b> for ${nReq} request${nReq > 1 ? "s" : ""}. ${per ? `${per} node${per > 1 ? "s are" : " is"} rebuilt per request or per injection; the rest are shared.` : "Every node is app-wide: requests share one immutable graph, so per-request state must flow through method arguments or context."} Switch the tool and compare <i>when</i> objects are built and <i>how</i> the recipe was found.`);
      return fr;
    },
    render: (f) => {
      const E = ECO[f.eco];
      const nodes = ORDER.map((k) => {
        const [title, L] = E.n[k];
        const ids = f.inst[k];
        const sub = `${LIFE_LABEL[L]} · ${ids.length ? ids.map((x) => `#${x.id}`).slice(-4).join(" ") : "none yet"}`;
        const cls = `${f.st[k] || (ids.length ? "done" : "dim")} lf-${L}`;
        return { id: k, x: POS[k][0], y: POS[k][1], title, sub, cls };
      });
      const edges = APP_EDGES.map(([u, v]) => ({ u, v, cls: f.cur === v ? "active" : "" }));
      const regs = ORDER.map((k) => `<div class="dal-reg ${f.regCur === k ? "cur" : ""}"><span class="dal-lf ${E.n[k][1]}">${LIFE_LABEL[E.n[k][1]]}</span><code>${esc(E.n[k][2])}</code></div>`).join("");
      return boxGraph(nodes, edges, { label: "OrderService dependency graph" }) + `<div class="v-labeled dal-regs-w"><span class="v-caption">recipes (registrations) for ${esc(f.eco)}</span><div class="dal-regs">${regs}</div></div>`;
    },
  }));

  /* =====================================================================
   * 3. Provider set → generated wiring code (Wire / Dagger) vs a runtime container
   * ===================================================================== */
  const CG_BASE = "NewConfig() -> Config; OpenDB(Config) -> *sql.DB; NewRepo(*sql.DB) -> Repository; NewHTTP() -> *http.Client; NewGateway(*http.Client, Config) -> PaymentGateway; NewService(Repository, PaymentGateway) -> *Service; NewServer(*Service, Config) -> *Server";
  const CG_SCEN = {
    "as typed": (ps) => ps,
    "forget NewHTTP": (ps) => ps.filter((p) => p.name !== "NewHTTP"),
    "add a cycle (Config needs *Service)": (ps) => ps.map((p) => (p.out === "Config" ? { ...p, deps: ["*Service"] } : p)),
    "two providers for PaymentGateway": (ps) => [...ps, { name: "NewFakeGateway", deps: [], out: "PaymentGateway" }],
    "an unused provider (NewMetrics)": (ps) => [...ps, { name: "NewMetrics", deps: ["Config"], out: "*Metrics" }],
  };
  const varName = (t) => { const b = t.replace(/^\*/, "").split(".").pop(); return b === b.toUpperCase() ? b.toLowerCase() : b[0].toLowerCase() + b.slice(1); };
  function parseProviders(s) {
    const out = [];
    for (const raw of String(s).split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = raw.match(/^([A-Za-z_][\w.]*)\s*\(([^)]*)\)\s*->\s*(\*?[A-Za-z_][\w.]*)$/);
      if (!m) throw new Error(`Cannot read "${raw}". Use Name(Dep, Dep) -> Type, separated by ";".`);
      out.push({ name: m[1], deps: m[2].split(",").map((x) => x.trim()).filter(Boolean), out: m[3] });
    }
    if (out.length < 1 || out.length > 12) throw new Error("Use 1 to 12 providers.");
    return out;
  }
  Viz.register("di-across-languages-codegen", (host) => Viz.player(host, {
    title: "From a provider set to wiring code: what Wire and Dagger generate",
    tag: "CODE GENERATION · STEP THROUGH",
    legend: [["active", "being resolved"], ["done", "line emitted"], ["bad", "build error"], ["dim", "not needed (yet)"]],
    code: [
      "resolve(type, chain):",
      "  if type already has a variable: reuse it",
      "  if type is on the chain: error \"cycle\"",
      "  providers = set[type]",
      "  if none: error \"no provider found … needed by\"",
      "  if more than one: error \"multiple bindings\"",
      "  for dep in provider.deps: resolve(dep, chain + type)",
      "  emit: v := Provider(args)",
      "after the target: unused providers? (Wire: error)",
    ],
    codeLang: "python",
    inputs: [
      { key: "ps", label: "providers: Name(Deps) -> Type; …", value: CG_BASE, width: 560 },
      { key: "target", label: "injector returns", value: "*Server", width: 90 },
      { key: "scen", label: "then", type: "select", options: Object.keys(CG_SCEN), value: "as typed" },
      { key: "style", label: "tool", type: "select", options: ["Wire (Go)", "Dagger (Java)", "runtime container"], value: "Wire (Go)" },
    ],
    random: () => ({ ps: CG_BASE, target: "*Server", scen: pick(Object.keys(CG_SCEN)), style: pick(["Wire (Go)", "Dagger (Java)", "runtime container"]) }),
    build: ({ ps, target, scen, style }) => {
      const provs = (CG_SCEN[scen] || ((x) => x))(parseProviders(ps));
      target = String(target).trim();
      if (!/^\*?[A-Za-z_][\w.]*$/.test(target)) throw new Error("The target is a type name such as *Server.");
      const runtime = style.startsWith("runtime"), dagger = style.startsWith("Dagger"), wire = style.startsWith("Wire");
      const byType = new Map();
      provs.forEach((p) => { if (!byType.has(p.out)) byType.set(p.out, []); byType.get(p.out).push(p); });
      const fr = [], emitted = [], have = new Map(), used = new Set();
      let err = null, cur = null, chain = [];
      const st = {};
      const snap = (line, note, more = {}) => fr.push({ line, note, provs, target, style, emitted: emitted.slice(), st: { ...st }, err, cur, chain: chain.slice(), used: [...used], vars: { resolving: cur || "-", depth: chain.length, lines: emitted.length, ...more } });
      const fnName = dagger ? "AppComponent" : "InitializeServer";
      snap(0, runtime
        ? `<b>Runtime container:</b> the same recipes, but nothing is generated. At startup (or on first resolve) the container walks this exact algorithm with reflection, every time the process starts. Errors therefore appear at <i>run</i> time.`
        : `<b>${esc(style)}:</b> you declare the recipes and an injector that returns <code>${esc(target)}</code>. The tool runs this algorithm <i>once, at build time</i>, and writes ordinary code (${wire ? "<code>wire_gen.go</code>" : "<code>DaggerAppComponent.java</code>"}). Errors stop the build.`);
      const disp = (t) => esc(t);
      const resolve = (type, why) => {
        if (err) return null;
        cur = type;
        if (have.has(type)) { snap(1, `<code>${disp(type)}</code> already has variable <code>${esc(have.get(type))}</code>: reuse it${why ? ` for ${esc(why)}` : ""}. Generated code builds each type once per injector call.`); return have.get(type); }
        if (chain.includes(type)) {
          const cyc = [...chain.slice(chain.indexOf(type)), type];
          st[type] = "bad";
          err = wire ? `wire: cycle for ${type}:\n${cyc.map((t, i) => `${t}${i < cyc.length - 1 ? ` (${(byType.get(t) || [{ name: "?" }])[0].name}) ->` : ""}`).join("\n")}`
            : dagger ? `error: [Dagger/DependencyCycle] Found a dependency cycle:\n${cyc.join(" → ")}`
            : `startup/first resolve: circular dependency ${cyc.join(" -> ")}`;
          snap(2, `<b>Cycle.</b> <code>${disp(type)}</code> is already being built higher up the chain. ${runtime ? "A runtime container reports this when it starts (or on the first resolve)." : "The build fails: no binary is produced."}`);
          return null;
        }
        const ps = byType.get(type) || [];
        chain.push(type); st[type] = "active";
        snap(3, `Need <code>${disp(type)}</code>${why ? ` for ${esc(why)}` : ""}. Providers that return it: ${ps.length ? ps.map((p) => `<code>${esc(p.name)}</code>`).join(", ") : "<b>none</b>"}.`);
        if (!ps.length) {
          st[type] = "bad";
          const neededBy = chain.slice(0, -1).reverse();
          err = wire ? `wire: inject ${fnName}: no provider found for ${type}\n${neededBy.map((t) => `\tneeded by ${t} in provider "${(byType.get(t) || [{ name: "?" }])[0].name}"`).join("\n")}`
            : dagger ? `error: [Dagger/MissingBinding] ${type} cannot be provided without an @Provides-annotated method.\n${neededBy.map((t) => `    ${t} is injected at …`).join("\n")}`
            : `No registration for ${type} (needed by ${neededBy.join(" <- ")})`;
          snap(4, `<b>Missing binding.</b> The error names the whole path, so you know which constructor asked. ${runtime ? "With a runtime container you see this when the app starts, or when the first request needs it." : "Caught before the code even compiles."}`);
          return null;
        }
        if (ps.length > 1) {
          st[type] = "bad";
          err = wire ? `wire: multiple bindings for ${type}\n${ps.map((p) => `\tcurrent: "${p.name}"`).join("\n")}`
            : dagger ? `error: [Dagger/DuplicateBindings] ${type} is bound multiple times:\n${ps.map((p) => `    @Provides ${type} ${p.name}()`).join("\n")}`
            : `(no error) last registration wins: ${ps[ps.length - 1].name}`;
          if (runtime) {
            snap(5, `<b>Two providers.</b> A runtime container like MS.DI or Nest silently picks the <i>last</i> one (<code>${esc(ps[ps.length - 1].name)}</code>). Spring and Guice would refuse. Code generators always refuse: ambiguity is a build error.`);
            err = null; st[type] = "active";
          } else {
            snap(5, `<b>Ambiguous.</b> ${esc(style)} will not guess. Remove one, or make them distinct types (Go: <code>type FakeGateway PaymentGateway</code>; Dagger: a <code>@Qualifier</code>).`);
            return null;
          }
        }
        const p = ps[ps.length - 1];
        used.add(p.name);
        const args = [];
        for (const d of p.deps) { const v = resolve(d, p.name); if (err) return null; args.push(v); cur = type; }
        const v = varName(type);
        have.set(type, v);
        const fallible = /^Open/.test(p.name);
        if (wire) {
          emitted.push(`${v}${fallible ? ", err" : ""} := ${p.name}(${args.join(", ")})`);
          if (fallible) emitted.push(`if err != nil {`, `\treturn nil, err`, `}`);
        } else if (dagger) emitted.push(`${type.replace(/^\*/, "").split(".").pop()} ${v} = module.${p.name[0].toLowerCase() + p.name.slice(1)}(${args.join(", ")});`);
        else emitted.push(`// reflect: ${p.name} params → [${p.deps.join(", ")}] → invoke`);
        chain.pop(); st[type] = "done";
        snap(7, `All dependencies of <code>${disp(type)}</code> exist, so ${runtime ? "the container invokes" : "the generator emits a call to"} <code>${esc(p.name)}</code>${fallible ? ". Its signature also returns an <code>error</code>, so Wire emits the error check you would have written" : ""}.`);
        return v;
      };
      const tv = resolve(target, null);
      if (!err) {
        if (wire) emitted.push(`return ${tv}, nil`); else if (dagger) emitted.push(`return ${tv};`);
        const unused = provs.filter((p) => !used.has(p.name));
        unused.forEach((p) => { st[p.out] = st[p.out] || (wire ? "bad" : "dim"); });
        if (unused.length && wire) {
          err = `wire: inject ${fnName}: unused provider "${unused.map((p) => p.name).join('", "')}"`;
          snap(8, `<b>Unused provider.</b> Wire treats a provider nobody needs as a mistake (it is usually a forgotten edge). Delete it from <code>wire.Build</code>, or make something depend on it.`);
        } else {
          snap(8, `<b>Done.</b> ${runtime ? `The container now holds this plan in memory; it redoes the walk on every process start.${unused.length ? ` Unused recipes (${unused.map((p) => esc(p.name)).join(", ")}) are simply never invoked.` : ""}` : `This is the entire generated injector: plain calls in dependency order, no reflection, no map lookups at runtime.${unused.length ? ` Dagger ignores unused bindings in a module (${unused.map((p) => esc(p.name)).join(", ")}).` : ""}`}`);
        }
      }
      return fr;
    },
    render: (f) => {
      const chips = f.provs.map((p) => {
        const s = f.st[p.out] || "dim";
        const usedCls = f.used.includes(p.name) ? "" : f.err && s === "bad" ? "" : "";
        return `<div class="dal-prov ${s} ${usedCls}"><code>${esc(p.name)}(${esc(p.deps.join(", "))})</code><span>→ <b>${esc(p.out)}</b></span></div>`;
      }).join("");
      const head = f.style.startsWith("Wire") ? ["// Code generated by Wire. DO NOT EDIT.", "func InitializeServer() (*Server, error) {"]
        : f.style.startsWith("Dagger") ? ["// Generated by Dagger (simplified: real output uses Provider fields)", "final class DaggerAppComponent implements AppComponent {", "  public Server server() {"]
        : ["// nothing generated: the plan lives in memory", "container.resolve(\"" + f.target + "\") {"];
      const tail = f.style.startsWith("Dagger") ? ["  }", "}"] : ["}"];
      const body = f.emitted.map((l, i) => `<div class="${i === f.emitted.length - 1 ? "new" : ""}">${esc((f.style.startsWith("Dagger") ? "    " : "\t") + l)}</div>`).join("");
      const code = `<div class="dal-gen"><div class="dal-mute">${head.map(esc).join("<br>")}</div>${body}<div class="dal-mute">${tail.map(esc).join("<br>")}</div></div>`;
      const errBox = f.err ? `<pre class="dal-err">${esc(f.err)}</pre>` : "";
      const chain = f.chain.length ? `<div class="dal-chain">${f.chain.map((t) => `<code>${esc(t)}</code>`).join(" ← needed by ← ".replace(/^/, "")) }</div>` : "";
      return `<div class="dal-cg"><div class="v-labeled dal-cg-l"><span class="v-caption">provider set</span><div class="dal-provs">${chips}</div>${f.chain.length ? `<span class="v-caption">resolution stack (outermost first)</span>${chain}` : ""}</div><div class="v-labeled dal-cg-r"><span class="v-caption">${f.style.startsWith("runtime") ? "what the container does at runtime" : "generated file"}</span>${code}</div></div>${errBox}`;
    },
  }));

  /* =====================================================================
   * 4. Spring proxies and @Transactional: self-invocation and final methods
   * ===================================================================== */
  const PX_VAR = {
    "@Transactional on placeOrder (called from controller)": "ok",
    "submit() calls this.placeOrder() (self-invocation)": "self",
    "facade bean calls orderService.placeOrder()": "facade",
    "@Transactional on a final placeOrder": "final",
  };
  Viz.register("di-across-languages-proxy", (host) => Viz.player(host, {
    title: "Spring injects a proxy, not your object: who actually opens the transaction?",
    tag: "AOP PROXIES · STEP THROUGH",
    legend: [["active", "current call"], ["done", "committed"], ["bad", "inconsistent / crash"], ["path", "proxy (CGLIB subclass)"]],
    code: [
      "@Service",
      "public class OrderService {",
      "  public void submit(Order o) { this.placeOrder(o); }",
      "  @Transactional",
      "  public void placeOrder(Order o) {",
      "    orders.insert(o);                 // row 1",
      "    stock.decrement(o.sku(), o.qty()); // row 2",
      "    payments.charge(o);               // may throw",
      "  }",
      "}",
    ],
    codeLang: "java",
    inputs: [
      { key: "v", label: "how it is called", type: "select", options: Object.keys(PX_VAR), value: "submit() calls this.placeOrder() (self-invocation)" },
      { key: "out", label: "payments.charge", type: "select", options: ["throws PaymentDeclinedException", "succeeds"], value: "throws PaymentDeclinedException" },
    ],
    random: () => ({ v: pick(Object.keys(PX_VAR)), out: pick(["throws PaymentDeclinedException", "succeeds"]) }),
    build: ({ v, out }) => {
      const k = PX_VAR[v];
      if (!k) throw new Error("Pick a call style.");
      const fail = out.startsWith("throws");
      const lanes = k === "facade" ? ["Controller", "Facade", "OrderService proxy", "OrderService", "Database"] : ["Controller", "OrderService proxy", "OrderService (target)", "Database"];
      const fr = [], msgs = [];
      const db = { orders: [], stock: 10, tx: "none" };
      const snap = (line, note, msg, extra = {}) => { if (msg) msgs.push(msg); fr.push({ line, note, lanes, msgs: msgs.map((m, i) => ({ ...m, cur: i === msgs.length - 1 && !!msg })), db: { ...db, orders: db.orders.slice() }, outcome: extra.outcome || null, vars: { tx: db.tx, "orders rows": db.orders.length, stock: db.stock } }); };
      const tgt = k === "facade" ? "OrderService" : "OrderService (target)", prx = k === "facade" ? "OrderService proxy" : "OrderService proxy";
      snap([], `<b>Startup.</b> Spring sees <code>@Transactional</code> and registers a <b>CGLIB subclass</b> of OrderService as the bean. Everyone who injects OrderService gets that subclass; it holds a reference to the real object and wraps public, overridable methods with "begin transaction → call target → commit / rollback".${k === "final" ? " Because <code>placeOrder</code> is <code>final</code>, the subclass cannot override it. Spring only logs a one-line notice." : ""}`);
      const write = (inTx) => {
        db.orders.push(inTx ? "order#42 (uncommitted)" : "order#42");
        snap(5, `<code>orders.insert</code>: ${inTx ? "written inside the open transaction, not yet visible to others." : "<b>no transaction is open</b>, so the JDBC connection is in auto-commit mode: this row is committed immediately."}`, { from: tgt, to: "Database", text: "INSERT order#42", cls: inTx ? "" : "warn" });
        db.stock -= 2;
        snap(6, `<code>stock.decrement</code>: ${inTx ? "also inside the transaction." : "committed on its own, immediately."}`, { from: tgt, to: "Database", text: "UPDATE stock -2", cls: inTx ? "" : "warn" });
      };
      const charge = (inTx) => {
        if (fail) {
          snap(7, `<code>payments.charge</code> throws <code>PaymentDeclinedException</code> (a RuntimeException).`, { from: tgt, to: tgt, text: "charge() ✗ throws", cls: "bad" });
          return false;
        }
        snap(7, `<code>payments.charge</code> succeeds.`, { from: tgt, to: tgt, text: "charge() ✓", cls: "" });
        void inTx; return true;
      };
      if (k === "ok" || k === "facade") {
        if (k === "facade") {
          snap([], "The controller calls <code>checkoutFacade.submit(o)</code>. The facade is a separate bean; it calls <code>orderService.placeOrder(o)</code> through the <b>injected reference</b>, which is the proxy.", { from: "Controller", to: "Facade", text: "submit(o)" });
          snap(4, "The call crosses a bean boundary, so it goes through OrderService's proxy.", { from: "Facade", to: prx, text: "placeOrder(o)", cls: "path" });
        } else snap(4, "The controller calls <code>orderService.placeOrder(o)</code>. Its field holds the <b>proxy</b>, so the call lands there first.", { from: "Controller", to: prx, text: "placeOrder(o)", cls: "path" });
        db.tx = "open";
        snap(3, "The proxy's TransactionInterceptor sees <code>@Transactional</code>: it borrows a connection, sets auto-commit off and binds the transaction to this thread.", { from: prx, to: "Database", text: "BEGIN", cls: "path" });
        snap(4, "Then it calls the real method on the target object.", { from: prx, to: tgt, text: "placeOrder(o)" });
        write(true);
        const ok = charge(true);
        if (ok) {
          db.tx = "committed"; db.orders = db.orders.map((r) => r.replace(" (uncommitted)", ""));
          snap(8, "The method returns normally; the proxy commits. Both rows appear together.", { from: prx, to: "Database", text: "COMMIT", cls: "done" }, { outcome: ["done", "Consistent: order and stock change committed together."] });
        } else {
          db.tx = "rolled back"; db.orders = []; db.stock = 10;
          snap(8, "The exception passes back through the proxy. A RuntimeException triggers rollback (checked exceptions do <i>not</i> by default; use <code>rollbackFor</code>).", { from: prx, to: "Database", text: "ROLLBACK", cls: "done" }, { outcome: ["done", "Consistent: nothing was written, the customer sees a clean error."] });
        }
      } else if (k === "self") {
        snap(2, "The controller calls <code>orderService.submit(o)</code>. <code>submit</code> has no annotation, so the proxy just forwards it to the target.", { from: "Controller", to: prx, text: "submit(o)", cls: "path" });
        snap(2, "Proxy → target, no transaction.", { from: prx, to: tgt, text: "submit(o)" });
        snap(2, "Inside the target, <code>this.placeOrder(o)</code> is a plain Java call on <code>this</code>, the real object. <b>The proxy never sees it</b>, so <code>@Transactional</code> on placeOrder is ignored. Nothing warns you.", { from: tgt, to: tgt, text: "this.placeOrder(o)", cls: "bad" });
        write(false);
        const ok = charge(false);
        if (ok) snap(8, "It \"works\": both rows are there. But they were committed separately; a crash between them would leave half an order. The bug is latent until the first failure.", null, { outcome: ["active", "Works by luck: two separate commits, no atomicity."] });
        else snap(8, "There is no transaction to roll back. The order row and the stock decrement are <b>already committed</b>.", null, { outcome: ["bad", "Inconsistent: order#42 exists and stock was reduced, but the payment failed."] });
      } else {
        snap(4, "The controller calls <code>orderService.placeOrder(o)</code> on the proxy.", { from: "Controller", to: prx, text: "placeOrder(o)", cls: "path" });
        snap(4, "<code>placeOrder</code> is final, so the call runs the <b>inherited</b> method body on the <b>proxy instance itself</b>, not on the target. The proxy was created without running your constructor, so its <code>orders</code> field is <code>null</code>.", { from: prx, to: prx, text: "placeOrder(o) (not intercepted)", cls: "bad" });
        snap(5, "<code>orders.insert(o)</code> → <code>NullPointerException</code>. No transaction was opened and nothing was written; the request fails with a 500. (Kotlin classes are final by default, which is why Spring's Kotlin plugin opens them.)", { from: prx, to: prx, text: "NullPointerException", cls: "bad" }, { outcome: ["bad", "Crash: NPE inside a proxy, a puzzling stack trace for a missing 'open' keyword."] });
      }
      return fr;
    },
    render: (f) => {
      const n = f.lanes.length;
      const cols = `grid-template-columns:repeat(${n}, minmax(0,1fr))`;
      const head = `<div class="dal-seqrow head" style="${cols}">${f.lanes.map((l) => `<div class="dal-lh ${/proxy/.test(l) ? "proxy" : l === "Database" ? "db" : ""}">${esc(l)}</div>`).join("")}</div>`;
      const rows = f.msgs.map((m) => {
        const a = f.lanes.indexOf(m.from), b = f.lanes.indexOf(m.to);
        const lo = Math.min(a, b), hi = Math.max(a, b);
        const lines = f.lanes.map((_, i) => `<i style="grid-column:${i + 1};grid-row:1"></i>`).join("");
        const arrow = a === b
          ? `<div class="dal-arrow self ${m.cls || ""} ${m.cur ? "cur" : ""}" style="grid-column:${a + 1};grid-row:1"><span>${esc(m.text)}</span></div>`
          : `<div class="dal-arrow ${b < a ? "rev" : ""} ${m.cls || ""} ${m.cur ? "cur" : ""}" style="grid-column:${lo + 1} / ${hi + 2};grid-row:1;--n:${hi - lo + 1}"><span>${esc(m.text)}</span></div>`;
        return `<div class="dal-seqrow" style="${cols}">${lines}${arrow}</div>`;
      }).join("");
      const seq = `<div class="dal-seq">${head}${rows}</div>`;
      const dbBox = `<div class="dal-db"><div><span class="v-caption">orders table</span>${f.db.orders.length ? f.db.orders.map((r) => `<code class="${/uncommitted/.test(r) ? "unc" : ""}">${esc(r)}</code>`).join("") : '<span class="dal-mute">(empty)</span>'}</div><div><span class="v-caption">stock (sku-7)</span><b>${f.db.stock}</b></div><div><span class="v-caption">transaction</span><b>${esc(f.db.tx)}</b></div></div>`;
      const out = f.outcome ? `<div class="dal-outcome ${f.outcome[0]}">${esc(f.outcome[1])}</div>` : "";
      return seq + dbBox + out;
    },
  }));

  /* =====================================================================
   * 5. Uber Fx: lazy providers, lifecycle hooks, reverse shutdown
   * ===================================================================== */
  const FX_P = [
    ["Config", "NewConfig", [], false],
    ["*zap.Logger", "NewLogger", ["Config"], false],
    ["*sql.DB", "OpenDB", ["Config", "*zap.Logger", "fx.Lifecycle"], ["ping the database", "db.Close()"]],
    ["*redis.Client", "NewCache", ["Config", "fx.Lifecycle"], ["connect to Redis", "rdb.Close()"]],
    ["*orders.Handler", "NewHandler", ["*sql.DB", "*redis.Client", "*zap.Logger"], false],
    ["*http.Server", "NewServer", ["*orders.Handler", "Config", "fx.Lifecycle"], ["net.Listen + go srv.Serve(ln)", "srv.Shutdown(ctx): drain requests"]],
    ["*Metrics", "NewMetrics", ["*zap.Logger", "fx.Lifecycle"], ["start the metrics pusher", "flush + stop pusher"]],
  ];
  const FX_INV = { "registerRoutes(*http.Server)": ["*http.Server"], "registerRoutes + metrics.Register": ["*http.Server", "*Metrics"], "no fx.Invoke at all": [] };
  Viz.register("di-across-languages-fx", (host) => Viz.player(host, {
    title: "Uber Fx: providers are lazy, hooks run in order, shutdown runs in reverse",
    tag: "LIFECYCLE · STEP THROUGH",
    legend: [["dim", "provided, never called"], ["done", "constructed / started"], ["active", "current"], ["bad", "failed"], ["path", "stopped"]],
    code: [
      "app := fx.New(",
      "  fx.Provide(NewConfig, NewLogger, OpenDB, NewCache,",
      "             NewHandler, NewServer, NewMetrics),",
      "  fx.Invoke(registerRoutes),",
      ")",
      "app.Start(ctx)   // OnStart hooks, in append order",
      "<-app.Done()     // wait for SIGTERM / SIGINT",
      "app.Stop(ctx)    // OnStop hooks, in reverse order",
    ],
    codeLang: "go",
    inputs: [
      { key: "inv", label: "fx.Invoke", type: "select", options: Object.keys(FX_INV), value: "registerRoutes(*http.Server)" },
      { key: "fail", label: "an OnStart hook fails", type: "select", options: ["none", "OpenDB (ping)", "NewCache (connect)", "NewServer (port in use)"], value: "none" },
    ],
    random: () => ({ inv: pick(Object.keys(FX_INV)), fail: pick(["none", "none", "NewCache (connect)", "NewServer (port in use)"]) }),
    build: ({ inv, fail }) => {
      const roots = FX_INV[inv];
      if (!roots) throw new Error("Pick an fx.Invoke option.");
      const failName = fail === "none" ? null : fail.split(" ")[0];
      const by = new Map(FX_P.map((p) => [p[0], p]));
      const st = {}, hooks = [], log = [], fr = [];
      FX_P.forEach((p) => { st[p[1]] = "dim"; });
      const snap = (line, note, ev, extra = {}) => { if (ev) log.push(ev); fr.push({ line, note, st: { ...st }, hooks: hooks.map((h) => ({ ...h })), log: log.slice(-8), cur: extra.cur || null, vars: { constructed: Object.values(st).filter((s) => s !== "dim").length, hooks: hooks.length, state: extra.state || "building" } }); };
      snap([0, 1, 2], "<b>fx.Provide only records constructors.</b> dig reads each function's parameter and result types by reflection, but calls nothing yet. Seven providers are registered.", "fx.Provide × 7 (nothing constructed)");
      if (!roots.length) {
        snap(3, "<b>No fx.Invoke.</b> Nothing asks for any type, so Fx never calls a single constructor. app.Start succeeds and does nothing. This is the classic \"why is my server not listening?\" bug: providers are lazy, invokes are the roots.", "no invokes: graph never built", { state: "idle" });
        return fr;
      }
      const built = new Set(), order = [];
      const build = (t, why) => {
        if (t === "fx.Lifecycle") return;
        const p = by.get(t);
        if (built.has(t)) return;
        st[p[1]] = "active";
        snap(3, `${esc(why)} needs <code>${esc(t)}</code> → resolve its parameters first: ${p[2].map((d) => `<code>${esc(d)}</code>`).join(", ") || "none"}.`, null, { cur: p[1] });
        p[2].forEach((d) => build(d, p[1]));
        built.add(t); order.push(p[1]); st[p[1]] = "done";
        if (p[3]) hooks.push({ name: p[1], start: p[3][0], stop: p[3][1], s: "pending" });
        snap(3, `Call <code>${esc(p[1])}</code>, cache the <code>${esc(t)}</code> it returns.${p[3] ? ` It appends an OnStart/OnStop pair to the lifecycle (hook #${hooks.length}). Constructors must not do I/O: the hook does.` : ""}`, `construct ${p[1]}${p[3] ? `  (+hook #${hooks.length})` : ""}`, { cur: p[1] });
      };
      roots.forEach((r) => build(r, r === "*Metrics" ? "metrics.Register" : "registerRoutes"));
      const unused = FX_P.filter((p) => !built.has(p[0])).map((p) => p[1]);
      snap(3, `fx.New is done. Construction order: ${order.map(esc).join(" → ")}.${unused.length ? ` <b>${unused.map(esc).join(", ")}</b> was never called: nothing reachable from an invoke needs it, so its OnStart hook does not exist either.` : ""}`, "fx.New ok", { state: "built" });
      let failed = false;
      for (let i = 0; i < hooks.length; i++) {
        const h = hooks[i];
        if (h.name === failName) {
          h.s = "bad"; failed = true;
          snap(5, `<b>OnStart #${i + 1} (${esc(h.name)}) fails:</b> ${esc(h.start)} returned an error.`, `OnStart ${h.name}: ERROR`, { cur: h.name, state: "starting" });
          for (let j = i - 1; j >= 0; j--) {
            hooks[j].s = "path";
            snap(7, `Rollback: Fx runs OnStop for the hooks that already started, newest first: <code>${esc(hooks[j].name)}</code> → ${esc(hooks[j].stop)}.`, `rollback OnStop ${hooks[j].name}`, { cur: hooks[j].name, state: "rolling back" });
          }
          snap(5, `app.Start returns the error and the process exits non-zero. ${i === 0 ? "Nothing had started, so nothing needed undoing." : "Resources opened by earlier hooks were released in reverse order."}`, "start failed → exit 1", { state: "failed" });
          break;
        }
        h.s = "done";
        snap(5, `OnStart #${i + 1}: <code>${esc(h.name)}</code> → ${esc(h.start)}. Hooks run in the order they were appended, which is construction order, so a dependency is always started before its dependents.`, `OnStart ${h.name}`, { cur: h.name, state: "starting" });
      }
      if (!failed) {
        snap(6, "All hooks started. The app is running; <code>app.Run()</code> blocks until SIGINT/SIGTERM.", "running…  SIGTERM received", { state: "running" });
        for (let j = hooks.length - 1; j >= 0; j--) {
          hooks[j].s = "path";
          snap(7, `OnStop (reverse order): <code>${esc(hooks[j].name)}</code> → ${esc(hooks[j].stop)}.${j === hooks.length - 1 ? " The server stops accepting and drains first, while the database is still open for in-flight requests." : ""}`, `OnStop ${hooks[j].name}`, { cur: hooks[j].name, state: "stopping" });
        }
        snap(7, "Clean shutdown: the reverse order is what makes \"drain requests, then close the pool\" automatic.", "stopped", { state: "stopped" });
      }
      return fr;
    },
    render: (f) => {
      const provs = FX_P.map((p) => `<div class="dal-fxp ${f.st[p[1]]} ${f.cur === p[1] ? "cur" : ""}"><code>${esc(p[1])}</code><small>→ ${esc(p[0])}</small></div>`).join("");
      const hooks = f.hooks.length ? f.hooks.map((h, i) => `<div class="dal-hook ${h.s} ${f.cur === h.name ? "cur" : ""}"><b>#${i + 1}</b><code>${esc(h.name)}</code><small>start: ${esc(h.start)}<br>stop: ${esc(h.stop)}</small><em>${{ pending: "appended", done: "started", bad: "failed", path: "stopped" }[h.s]}</em></div>`).join("") : '<span class="dal-mute">no hooks appended yet</span>';
      const log = f.log.map((l, i) => `<div class="${i === f.log.length - 1 ? "cur" : ""}">${esc(l)}</div>`).join("");
      return `<div class="dal-fx"><div class="v-labeled"><span class="v-caption">providers</span><div class="dal-fxps">${provs}</div></div><div class="v-labeled"><span class="v-caption">lifecycle (append order ↓)</span><div class="dal-hooks">${hooks}</div></div><div class="v-labeled"><span class="v-caption">log</span><div class="dal-log">${log}</div></div></div>`;
    },
  }));

  /* =====================================================================
   * 6. FastAPI Depends: per-request graph, caching, yield teardown timing
   * ===================================================================== */
  Viz.register("di-across-languages-fastapi", (host) => Viz.player(host, {
    title: "FastAPI Depends: one request, step by step (setup, endpoint, response, teardown)",
    tag: "PER-REQUEST GRAPH · STEP THROUGH",
    legend: [["active", "running now"], ["done", "value ready"], ["path", "cached in this request"], ["visit", "overridden"], ["bad", "error"]],
    code: [
      "def get_session():",
      "    with Session(engine) as session:",
      "        yield session",
      "        session.commit()",
      "def get_order_service(s=Depends(get_session), p=Depends(get_payments)):",
      "    return OrderService(s, p)",
      "def get_current_user(s=Depends(get_session), t=Depends(oauth2_scheme)): ...",
      "@app.post(\"/orders\", status_code=201)",
      "def place_order(body: NewOrder, svc=Depends(get_order_service),",
      "                user=Depends(get_current_user)): ...",
    ],
    codeLang: "python",
    inputs: [
      { key: "scope", label: "get_session scope", type: "select", options: ["request (default)", "function"], value: "request (default)" },
      { key: "cache", label: "get_current_user's session", type: "select", options: ["shared (use_cache=True)", "own (use_cache=False)"], value: "shared (use_cache=True)" },
      { key: "out", label: "endpoint", type: "select", options: ["returns", "raises HTTPException(409)", "raises ValueError"], value: "returns" },
      { key: "commit", label: "session.commit()", type: "select", options: ["succeeds", "fails (IntegrityError)"], value: "fails (IntegrityError)" },
      { key: "ovr", label: "test override", type: "select", options: ["none", "get_payments → FakePayments"], value: "none" },
    ],
    random: () => ({ scope: pick(["request (default)", "function"]), cache: pick(["shared (use_cache=True)", "own (use_cache=False)"]), out: pick(["returns", "returns", "raises HTTPException(409)", "raises ValueError"]), commit: pick(["succeeds", "fails (IntegrityError)"]), ovr: pick(["none", "get_payments → FakePayments"]) }),
    build: ({ scope, cache, out, commit, ovr }) => {
      const fnScope = scope === "function", own = cache.startsWith("own"), fake = ovr !== "none", commitFails = commit.startsWith("fails");
      const st = {}, lab = {}, log = [], fr = [];
      let client = null;
      const snap = (line, note, ev, phase) => { if (ev) log.push([phase, ev]); fr.push({ line, note, st: { ...st }, lab: { ...lab }, log: log.slice(), client, own, vars: { sessions: own ? 2 : 1, phase: phase || "-", client: client ? client[1] : "waiting" } }); };
      snap(8, `<b>POST /orders arrives.</b> At import time FastAPI already analysed <code>place_order</code>'s signature and built a dependency tree. Now it solves it, depth first, in parameter order. Each dependency runs at most once per request unless <code>use_cache=False</code>.`, "request received", "setup");
      st.os = "active"; snap(4, "<code>svc=Depends(get_order_service)</code> first. Its own parameters are dependencies too.", null, "setup");
      st.s1 = "active"; snap(0, "<code>get_session</code> is a generator: FastAPI runs it <b>up to the <code>yield</code></b>, keeps the generator suspended, and records it on the request's exit stack.", null, "setup");
      st.s1 = "done"; lab.s1 = "Session #1"; snap(2, "Session #1 is open and injected. The code after <code>yield</code> has not run yet.", "get_session: open Session #1 (suspended at yield)", "setup");
      if (fake) { st.pay = "visit"; lab.pay = "FakePayments()"; snap(4, "<code>app.dependency_overrides[get_payments]</code> is set, so FastAPI calls the override instead. No container, no registration: the <i>function object</i> is the key.", "get_payments → override → FakePayments", "setup"); }
      else { st.pay = "done"; lab.pay = "StripeGateway"; snap(4, "<code>get_payments()</code> returns a StripeGateway around a module-level httpx client.", "get_payments → StripeGateway", "setup"); }
      st.os = "done"; snap(5, "<code>get_order_service</code> now has both arguments and returns an OrderService. Cached for this request.", "get_order_service → OrderService(#1)", "setup");
      st.cu = "active"; snap(6, "<code>user=Depends(get_current_user)</code> needs a session too.", null, "setup");
      if (own) { st.s2 = "done"; lab.s2 = "Session #2"; snap(0, "<code>Depends(get_session, use_cache=False)</code>: the cache is bypassed and a <b>second session</b> opens: a second connection and a second transaction that cannot see Session #1's uncommitted writes.", "get_session (use_cache=False): open Session #2", "setup"); }
      else { st.s1 = "path"; snap(2, "<code>get_session</code> already ran in this request, so the <b>cached value (Session #1)</b> is reused. Service and auth share one unit of work. This per-request cache is FastAPI's \"scoped lifetime\".", "get_session: cached → Session #1", "setup"); st.s1 = "done"; }
      st.tok = "done"; snap(6, "<code>oauth2_scheme</code> reads the bearer token from the Authorization header (it would raise 401 here if missing).", "oauth2_scheme → token", "setup");
      st.cu = "done"; snap(6, "<code>get_current_user</code> returns the user.", "get_current_user → user", "setup");
      st.ep = "active"; snap(9, "All dependencies are resolved. The endpoint runs.", "place_order(...) runs", "endpoint");
      const sess = own ? ["#2", "#1"] : ["#1"];
      const teardown = (exc) => {
        sess.forEach((s) => {
          const k = s === "#1" ? "s1" : "s2";
          if (exc) { st[k] = "bad"; snap(2, `The exception is <b>thrown into</b> get_session (Session ${s}) at its <code>yield</code>. <code>session.commit()</code> is skipped; leaving the <code>with</code> block closes the session and the transaction rolls back. The exception propagates on.`, `teardown Session ${s}: rollback + close`, "teardown"); }
          else if (s === "#1" && commitFails) { st[k] = "bad"; snap(3, `<code>session.commit()</code> on Session ${s} raises <b>IntegrityError</b> (say, a unique constraint).`, `teardown Session ${s}: commit → IntegrityError`, "teardown"); }
          else { st[k] = "path"; snap(3, `Code after <code>yield</code> runs for Session ${s}: commit, then close. Exit stacks unwind in reverse (LIFO), so the newest dependency tears down first.`, `teardown Session ${s}: commit + close`, "teardown"); }
        });
      };
      if (out === "returns") {
        st.ep = "done";
        if (fnScope) {
          snap(9, "The endpoint returned. With <code>Depends(get_session, scope=\"function\")</code>, teardown runs <b>now, before the response is sent</b>.", "place_order returned", "endpoint");
          teardown(false);
          if (commitFails) { client = ["bad", "500 Internal Server Error"]; snap(3, "The commit error happened before the response, so the client is told the truth: <b>500</b>, and can retry. No order was saved.", "response 500 sent", "response"); }
          else { client = ["done", "201 Created"]; snap(3, "Commit succeeded, then the 201 is sent. The client only hears \"created\" after the data is durable.", "response 201 sent", "response"); }
        } else {
          client = ["done", "201 Created"];
          snap(9, "The endpoint returned. With the default <code>scope=\"request\"</code> the response is serialized and <b>sent first</b>. The client already has <b>201 Created</b>.", "response 201 sent", "response");
          teardown(false);
          if (commitFails) { client = ["bad", "201 Created (but nothing was saved)"]; snap(3, "<b>The gotcha:</b> the commit failed <i>after</i> the client was told 201. The error is only logged on the server. If the commit matters to the response, commit inside the endpoint/service, or use <code>scope=\"function\"</code> for this dependency.", "IntegrityError logged; client never knows", "teardown"); }
          else snap(3, "Done. Works fine as long as the commit cannot fail, which is a big assumption for a database write.", null, "teardown");
        }
      } else {
        st.ep = "bad";
        snap(9, `The endpoint ${out === "raises ValueError" ? "has a bug and raises <code>ValueError</code>" : "raises <code>HTTPException(409)</code>"}.`, `place_order raised ${out.replace("raises ", "")}`, "endpoint");
        teardown(true);
        client = out === "raises ValueError" ? ["bad", "500 Internal Server Error"] : ["active", "409 Conflict"];
        snap(9, `After the yield dependencies have handled it, ${out === "raises ValueError" ? "the unhandled error becomes a <b>500</b>" : "FastAPI's HTTPException handler sends the <b>409</b>"}. Because the exception reached <code>get_session</code> first, nothing was committed: rollback is automatic if your dependency uses <code>with</code> (or try/except, then re-raise).`, `response ${client[1]} sent`, "response");
      }
      return fr;
    },
    render: (f) => {
      const nodes = [
        { id: "ep", x: 90, y: 120, title: "place_order", sub: "endpoint", cls: f.st.ep || "dim" },
        { id: "os", x: 300, y: 55, title: "get_order_service", sub: "OrderService", cls: f.st.os || "dim" },
        { id: "cu", x: 300, y: 185, title: "get_current_user", sub: "user", cls: f.st.cu || "dim" },
        { id: "s1", x: 530, y: f.own ? 25 : 120, title: "get_session", sub: f.lab.s1 || "(yield)", cls: f.st.s1 || "dim" },
        { id: "pay", x: 530, y: f.own ? 95 : 40, title: "get_payments", sub: f.lab.pay || "", cls: f.st.pay || "dim" },
        { id: "tok", x: 530, y: f.own ? 235 : 200, title: "oauth2_scheme", sub: "token", cls: f.st.tok || "dim" },
      ];
      const edges = [{ u: "ep", v: "os" }, { u: "ep", v: "cu" }, { u: "os", v: "s1" }, { u: "os", v: "pay" }, { u: "cu", v: "tok" }];
      if (f.own) { nodes.push({ id: "s2", x: 530, y: 165, title: "get_session", sub: f.lab.s2 || "use_cache=False", cls: f.st.s2 || "dim" }); edges.push({ u: "cu", v: "s2" }); }
      else edges.push({ u: "cu", v: "s1", cls: "path" });
      const log = f.log.map(([p, e], i) => `<div class="dal-fe ${p} ${i === f.log.length - 1 ? "cur" : ""}"><em>${esc(p)}</em>${esc(e)}</div>`).join("");
      const client = `<div class="dal-client ${f.client ? f.client[0] : ""}"><span class="v-caption">client sees</span><b>${esc(f.client ? f.client[1] : "… waiting")}</b></div>`;
      return boxGraph(nodes, edges, { label: "FastAPI dependency tree" }) + `<div class="dal-fa-bottom"><div class="v-labeled dal-felog"><span class="v-caption">event order</span><div class="dal-fes">${log}</div></div>${client}</div>`;
    },
  }));

  /* =====================================================================
   * 7. TypeScript: what survives compilation, and what the container sees
   * ===================================================================== */
  const TS_TOOL = {
    "tsc: experimentalDecorators + emitDecoratorMetadata": "meta",
    "SWC: legacyDecorator + decoratorMetadata": "meta",
    "esbuild / Vite / Vitest (default)": "nometa",
    "tsc 5: standard decorators": "std",
  };
  const TS_PARAM = {
    "class PgOrderRepository": ["PgOrderRepository", "PgOrderRepository"],
    "abstract class OrderRepository": ["OrderRepository", "OrderRepository"],
    "interface OrderRepository": ["OrderRepository", "Object"],
    "interface + explicit token": ["OrderRepository", "Object", true],
  };
  const TS_C = {
    NestJS: { dec: "@Injectable()", inj: "@Inject(ORDER_REPO) ", imp: "import { Injectable, Inject } from '@nestjs/common';" },
    tsyringe: { dec: "@injectable()", inj: "@inject('OrderRepository') ", imp: "import { injectable, inject } from 'tsyringe';" },
    InversifyJS: { dec: "@injectable()", inj: "@inject(TYPES.OrderRepository) ", imp: "import { injectable, inject } from 'inversify';" },
  };
  Viz.register("di-across-languages-tsmeta", (host) => Viz.player(host, {
    title: "TypeScript DI: types are erased, so what does the container actually see?",
    tag: "COMPILE → EMIT → RESOLVE",
    legend: [["done", "resolves"], ["active", "works, with a caveat"], ["bad", "fails"]],
    code: ["1. you write a constructor parameter with a type", "2. the compiler erases types; it may emit design:paramtypes", "3. parameter decorators may record explicit tokens", "4. the container reads 2 + 3 and resolves each argument"],
    inputs: [
      { key: "tool", label: "build tool", type: "select", options: Object.keys(TS_TOOL), value: "esbuild / Vite / Vitest (default)" },
      { key: "param", label: "parameter type", type: "select", options: Object.keys(TS_PARAM), value: "class PgOrderRepository" },
      { key: "c", label: "container", type: "select", options: Object.keys(TS_C), value: "NestJS" },
    ],
    random: () => ({ tool: pick(Object.keys(TS_TOOL)), param: pick(Object.keys(TS_PARAM)), c: pick(Object.keys(TS_C)) }),
    build: ({ tool, param, c }) => {
      const T = TS_TOOL[tool], P = TS_PARAM[param], C = TS_C[c];
      if (!T || !P || !C) throw new Error("Pick from the lists.");
      const [srcType, metaType, token] = P;
      const src = [C.imp, "", C.dec, "export class OrderService {", `  constructor(${token ? C.inj : ""}private readonly repo: ${srcType}) {}`, "}"];
      let emit, status, result, why;
      if (T === "std" && token) {
        emit = ["error TS1206: Decorators are not valid here."];
        status = "bad"; result = "Compile error: parameter decorators do not exist in standard (TC39) decorators.";
        why = "Without <code>experimentalDecorators</code>, TypeScript 5 uses the standard decorator proposal, which has no parameter decorators and no metadata emit. NestJS, tsyringe and InversifyJS (up to v6) are built on the legacy model, so they need <code>experimentalDecorators: true</code>.";
      } else {
        const meta = T === "meta";
        emit = ["let OrderService = class OrderService {", "    constructor(repo) { this.repo = repo; }", "};", T === "std" ? "OrderService = __esDecorate(…standard decorator call…);" : "OrderService = __decorate([", ...(T === "std" ? [] : [`    ${C.dec.slice(1)},`, ...(token ? [`    __param(0, ${C.inj.trim().slice(1)}),`] : []), ...(meta ? [`    __metadata("design:paramtypes", [${metaType}])`] : ["    // no __metadata line: this tool does not emit it"]), "], OrderService);"])];
        const known = meta ? metaType : null;
        const tok = token ? (c === "NestJS" ? "ORDER_REPO" : c === "tsyringe" ? "'OrderRepository'" : "TYPES.OrderRepository") : null;
        if (tok) {
          status = "done"; result = `Resolves: the explicit token ${tok} is used for argument 0.`;
          why = `An explicit token works with <i>every</i> legacy-decorator toolchain because it is a runtime value recorded by the parameter decorator, not type information. ${meta ? "The metadata says <code>Object</code>, but the token overrides it." : "There is no metadata at all, and it does not matter."}`;
        } else if (known === "Object") {
          status = "bad";
          result = c === "NestJS" ? "Nest can't resolve dependencies of the OrderService (?). Please make sure that the argument Object at index [0] is available in the OrdersModule context."
            : c === "tsyringe" ? 'Error: TypeInfo not known for "Object"' : "Error: No matching bindings found for serviceIdentifier: Object";
          why = "An interface does not exist at runtime, so the compiler writes <code>Object</code> into the metadata. Use an abstract class as the token, or an explicit token (string/symbol/InjectionToken) with a parameter decorator.";
        } else if (known) {
          status = "done";
          result = `Resolves: the container looks up ${known}${srcType === "OrderRepository" ? " (registered with useClass/to(PgOrderRepository))" : ""}.`;
          why = srcType === "OrderRepository" ? "An <b>abstract class</b> survives compilation as a real constructor function, so it doubles as the injection token and the type. This is why NestJS code often uses abstract classes instead of interfaces." : "The concrete class is a runtime value; the metadata points straight at it.";
        } else {
          if (c === "NestJS") { status = "bad"; result = "No error at bootstrap. Nest finds no paramtypes, calls new OrderService() with zero arguments, and the first request fails with: TypeError: Cannot read properties of undefined (reading 'save')"; }
          else if (c === "tsyringe") { status = "bad"; result = 'Error: TypeInfo not known for "OrderService"'; }
          else { status = "bad"; result = "Error: Missing required @inject or @multiInject annotation in: argument 0 in class OrderService."; }
          why = `${T === "nometa" ? "esbuild (and therefore Vite and Vitest) strips types and <b>never emits <code>design:paramtypes</code></b>, even with emitDecoratorMetadata in tsconfig." : "Standard decorators emit no metadata."} The container has no idea what the constructor wants. Fix: build with tsc or SWC (for Vitest, the unplugin-swc plugin), or put an explicit token on every parameter.`;
        }
      }
      const fr = [];
      fr.push({ src, emit: null, status: null, result: null, line: 0, note: `<b>Source.</b> To a human, <code>repo: ${esc(srcType)}</code> says exactly what OrderService needs. ${srcType === "OrderRepository" && !param.startsWith("abstract") ? "But an interface is a compile-time-only construct." : ""}`, vars: { tool: tool.split(":")[0], container: c } });
      fr.push({ src, emit, status: null, result: null, line: [1, 2], note: `<b>Compile with ${esc(tool)}.</b> Types are gone. ${T === "meta" ? "This toolchain adds a <code>design:paramtypes</code> array: the only runtime trace of the parameter types." : T === "nometa" ? "This toolchain keeps the decorators but writes no type metadata." : token ? "This does not compile." : "Standard decorators carry no parameter information."}`, vars: { tool: tool.split(":")[0], container: c, metadata: T === "meta" ? "design:paramtypes" : "none" } });
      fr.push({ src, emit, status, result, line: 3, note: why, vars: { tool: tool.split(":")[0], container: c, result: status === "done" ? "ok" : "fails" } });
      return fr;
    },
    render: (f) => {
      const pane = (cap, lines, cls = "") => `<div class="v-labeled dal-ts-p ${cls}"><span class="v-caption">${cap}</span><pre class="dal-ts-code">${lines ? lines.map((l) => esc(l)).join("\n") : '<span class="dal-mute">…</span>'}</pre></div>`;
      const res = f.result ? `<div class="dal-outcome ${f.status}">${esc(f.result)}</div>` : "";
      return `<div class="dal-ts">${pane("order.service.ts (you write)", f.src)}${pane("order.service.js (emitted)", f.emit, f.emit && f.emit[0].startsWith("error") ? "bad" : "")}</div>${res}`;
    },
  }));

  /* =====================================================================
   * 8. Which DI approach? A decision walker
   * ===================================================================== */
  const CH_LANG = ["C# / .NET", "Java / Kotlin", "Python", "Go", "TypeScript / Node"];
  const CH_KIND = ["web API / service", "library or SDK", "CLI or script", "serverless function", "mobile app"];
  function choose(lang, kind, cold, size) {
    const big = size.startsWith("large"), coldM = cold.startsWith("matters");
    if (kind === "library or SDK") return {
      rec: lang.startsWith("C#") ? "No container inside the library. Constructor parameters, plus an optional services.AddMyLibrary() extension that uses TryAdd* so the host can override." : lang.startsWith("Java") ? "No container inside the library. Plain constructors; ship a separate Spring Boot auto-configuration module if Spring users matter." : lang === "Go" ? "No container. Exported constructors with functional options (NewClient(opts ...Option))." : lang === "Python" ? "No container. Constructor/function parameters with sensible defaults." : "No container. Constructor parameters or factory functions; never require decorator metadata from your users' build.",
      why: "A library that brings its own container forces its lifetime model and its framework version on every consumer. The host's composition root should decide.", cost: "A few more constructor parameters in your public API.", path: ["kind"],
    };
    if (kind === "CLI or script") return { rec: lang.startsWith("C#") ? "Manual wiring in Main, or Host.CreateApplicationBuilder if you want configuration + logging + MS.DI for free." : "Manual wiring in main(): build the handful of objects in order and pass them down.", why: "Short-lived process, small graph: a container adds startup cost and indirection for nothing.", cost: "You write the 10–30 lines of wiring yourself, and the compiler checks them.", path: ["kind"] };
    if (kind === "mobile app") return { rec: lang.startsWith("Java") ? "Hilt (Dagger for Android): compile-time graph, Android lifecycle scopes built in." : lang.startsWith("C#") ? "MS.DI via MauiAppBuilder.Services: it is already there." : "Plain constructors / framework context (React Native: context + factories). Avoid reflection-heavy containers on devices.", why: "Mobile apps care about startup time and binary size, which favours compile-time or manual wiring.", cost: lang.startsWith("Java") ? "Annotation processing (kapt/KSP) build time." : "Manual wiring code.", path: ["kind"] };
    const path = ["kind", "cold", "size"];
    if (lang.startsWith("C#")) return coldM || kind === "serverless function"
      ? { rec: "MS.DI (it is fast: resolution is a compiled delegate) + ValidateOnBuild. For the coldest starts, Native AOT with source-generated configuration binding; avoid assembly scanning.", why: "Container resolution is rarely the cold-start cost in .NET; JIT and reflection-based scanning are.", cost: "AOT forbids some reflection-heavy libraries.", path }
      : { rec: big ? "MS.DI with ValidateOnBuild + ValidateScopes always on, Scrutor for scanning and decorators, keyed services for variants. Autofac only if you need child scopes or modules MS.DI lacks." : "MS.DI (built into ASP.NET Core) with ValidateOnBuild + ValidateScopes always on.", why: "It is the framework's container: every library ships AddXxx() for it.", cost: "Startup-time validation only; decorators and scanning need Scrutor.", path };
    if (lang.startsWith("Java")) return coldM || kind === "serverless function"
      ? { rec: "Build-time DI: Micronaut or Quarkus (Jakarta CDI at build time), Dagger for non-framework code, or Spring Boot with AOT + GraalVM native image.", why: "Classic Spring scans the classpath and creates proxies at startup, which costs seconds on a cold start.", cost: "Native images restrict reflection; you must declare hints for what remains.", path }
      : { rec: big ? "Spring Boot: constructor injection only, one constructor per bean, @ConfigurationProperties, no field injection." : "Spring Boot if the team already uses it; otherwise Dagger or plain constructors keep it simple.", why: "Spring's ecosystem (transactions, security, data) is the reason to accept its container.", cost: "Startup time, proxy surprises (self-invocation, final methods), errors only at context refresh.", path };
    if (lang === "Python") return { rec: kind === "serverless function" ? "Module-level objects built once per cold start (manual), passed into handler functions." : big ? "FastAPI Depends for request-scoped things (session, current user), app-wide objects in lifespan/app.state, and dependency-injector containers if the graph outgrows that." : "FastAPI Depends for per-request things, plain module-level factories for the rest.", why: "Python has no compile step, so a container cannot check anything earlier than import time anyway; keep the graph visible.", cost: "Mistakes surface at import or request time; add one test that builds the whole graph.", path };
    if (lang === "Go") return { rec: coldM || !big ? "Manual wiring in main(). It is the idiomatic default." : "Manual wiring until main() hurts; then Wire (compile-time, generates the same code) or Fx (runtime, adds lifecycle hooks and modules).", why: "Go favours explicit code; implicit interfaces already make every constructor a seam.", cost: big ? "Wire: a generate step; Fx: reflection and errors at startup." : "A long main() as the app grows.", path };
    return { rec: kind === "serverless function" || coldM ? "Plain factory functions / a hand-written composition root. Bundlers (esbuild) drop decorator metadata anyway." : big ? "NestJS if you adopt the whole framework (modules, guards, interceptors). Otherwise a hand-written composition root; tsyringe or InversifyJS only with explicit tokens." : "A hand-written composition root: createApp(deps) and factory functions.", why: "TypeScript erases types, so every container depends on decorator metadata or explicit tokens.", cost: big ? "Nest: decorators, eager bootstrap, metadata-dependent builds." : "You write the wiring yourself.", path };
  }
  Viz.register("di-across-languages-choose", (host) => Viz.player(host, {
    title: "Which DI approach fits this project?",
    tag: "DECISION WALKER",
    legend: [["active", "this question"], ["done", "answered"], ["path", "recommendation"]],
    inputs: [
      { key: "lang", label: "language", type: "select", options: CH_LANG, value: "Go" },
      { key: "kind", label: "what you are building", type: "select", options: CH_KIND, value: "web API / service" },
      { key: "cold", label: "cold start", type: "select", options: ["matters (serverless, CLI, scale-to-zero)", "does not matter"], value: "does not matter" },
      { key: "size", label: "object graph", type: "select", options: ["small (under ~30 types)", "large (hundreds of types, many teams)"], value: "large (hundreds of types, many teams)" },
    ],
    random: () => ({ lang: pick(CH_LANG), kind: pick(CH_KIND), cold: pick(["matters (serverless, CLI, scale-to-zero)", "does not matter"]), size: pick(["small (under ~30 types)", "large (hundreds of types, many teams)"]) }),
    build: ({ lang, kind, cold, size }) => {
      if (!CH_LANG.includes(lang) || !CH_KIND.includes(kind)) throw new Error("Pick from the lists.");
      const r = choose(lang, kind, cold, size);
      const qs = [["lang", "Which language?", lang], ["kind", "What are you building?", kind], ["cold", "Does startup time matter?", cold], ["size", "How big is the object graph?", size]];
      const used = new Set(["lang", ...r.path]);
      const fr = [];
      const asked = [];
      qs.forEach(([k, q, a]) => {
        if (!used.has(k)) return;
        asked.push(k);
        fr.push({ qs, used: [...asked], cur: k, r: null, note: `<b>${esc(q)}</b> → ${esc(a)}. ${k === "kind" && r.path.length === 1 ? "That alone decides it." : ""}` });
      });
      fr.push({ qs, used: [...asked], cur: null, r, note: `<b>Recommendation:</b> ${esc(r.rec)}` });
      return fr;
    },
    render: (f) => {
      const steps = f.qs.map(([k, q, a]) => {
        const on = f.used.includes(k);
        return `<div class="dal-q ${f.cur === k ? "active" : on ? "done" : "skip"}"><small>${esc(q)}</small><b>${on ? esc(a) : "(not needed)"}</b></div>`;
      }).join('<span class="dal-qa">→</span>');
      const rec = f.r ? `<div class="dal-rec"><div><span class="v-caption">use</span><p>${esc(f.r.rec)}</p></div><div><span class="v-caption">why</span><p>${esc(f.r.why)}</p></div><div><span class="v-caption">what it costs</span><p>${esc(f.r.cost)}</p></div></div>` : "";
      return `<div class="dal-qs">${steps}</div>${rec}`;
    },
  }));
})();
