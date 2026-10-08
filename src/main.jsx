import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Camera,
  CalendarDays,
  Bell,
  ChevronLeft,
  Dumbbell,
  Droplets,
  Copy,
  Flame,
  Home,
  HeartPulse,
  LineChart,
  LogOut,
  Pause,
  Play,
  Plus,
  Salad,
  Search,
  Settings,
  Star,
  Target,
  Trophy,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabase";
import { recipesFor, tacoFoods } from "./nutrition-data";
import {
  calculateBmi,
  calculateNutritionTargets,
  evaluateWeightGoal,
  profileVariant,
  recommendedRecipeServing,
} from "./personalization";
import {
  caloriesRemaining,
  parseSetCount,
  selectCurrentWorkout,
  sessionsInCurrentWeek,
  startOfCurrentWeek,
} from "./domain";
import "./styles.css";
import "./search-filter.css";
import "./workout-ui.css";
import "./game-theme.css";

const steps = [
  "Objetivo",
  "Ambiente",
  "Rotina",
  "Experiência",
  "Corpo",
  "Cuidados",
  "Alimentação",
];
const goals = [
  ["Emagrecer", "Reduzir gordura e melhorar o condicionamento"],
  ["Ganhar massa", "Construir músculos com progressão segura"],
  ["Recomposição", "Perder gordura enquanto desenvolve massa magra"],
];
const blank = {
  goal: "",
  place: "",
  days: 3,
  level: "Iniciante",
  sex: "",
  age: "",
  height: "",
  weight: "",
  restrictions: "",
  equipment: "",
  activity: "Moderadamente ativo",
  meals: 4,
  diet: "Sem preferência",
  foodRestrictions: "",
};
function Logo() {
  return (
    <div className="logo evoquestLogo">
      <img
        className="evoquestLogoImage"
        src={`${import.meta.env.BASE_URL}branding/evoquest-logo.png`}
        alt="EVOQUEST"
        draggable="false"
      />
    </div>
  );
}

function readEvoquestStorage(key) {
  const current = localStorage.getItem(`evoquest-${key}`);
  if (current !== null) return current;
  const legacy = localStorage.getItem(`movra-${key}`);
  if (legacy !== null) localStorage.setItem(`evoquest-${key}`, legacy);
  return legacy;
}

function useArcadeAudio() {
  const contextRef = useRef(null);
  const [enabled, setEnabled] = useState(
    () => readEvoquestStorage("sound") === "on",
  );
  useEffect(() => {
    localStorage.setItem("evoquest-sound", enabled ? "on" : "off");
    if (!enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = contextRef.current || new AudioContext();
    contextRef.current = ctx;
    ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.035;
    master.connect(ctx.destination);
    const notes = [130.81, 164.81, 196, 246.94, 196, 164.81];
    let step = 0;
    const tone = (frequency, duration = 0.12, volume = 0.28) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain).connect(master);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    };
    const interval = window.setInterval(() => {
      if (!document.hidden) tone(notes[step++ % notes.length], 0.16, 0.18);
    }, 620);
    const click = (event) => {
      ctx.resume();
      if (event.target.closest("button,a")) tone(392, 0.055, 0.35);
    };
    document.addEventListener("click", click);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", click);
      ctx.close();
      contextRef.current = null;
    };
  }, [enabled]);
  function toggle() {
    if (!enabled) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        contextRef.current = contextRef.current || new AudioContext();
        contextRef.current.resume();
      }
    }
    setEnabled((value) => !value);
  }
  return [enabled, toggle];
}

function SoundToggle({ enabled, toggle }) {
  return (
    <button
      className="soundToggle"
      onClick={toggle}
      title="Ativar ou desativar som"
    >
      {enabled ? <Volume2 /> : <VolumeX />}
      <span>{enabled ? "Som ligado" : "Ativar som"}</span>
    </button>
  );
}

function SettingsMenu({ enabled, toggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="settingsMenu">
      <button
        type="button"
        className={`settingsGear ${open ? "active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir configurações"
        aria-expanded={open}
      >
        <Settings />
      </button>
      {open && (
        <div className="settingsPopover">
          <span>CONFIGURAÇÕES</span>
          <div>
            <b>Som arcade</b>
            <small>{enabled ? "Ligado" : "Desligado"}</small>
          </div>
          <SoundToggle enabled={enabled} toggle={toggle} />
        </div>
      )}
    </div>
  );
}

function SpriteActor({ character = "a", action = "idle", className = "" }) {
  return (
    <span
      className={`spriteActor character-${character} action-${action} ${className}`}
      aria-hidden="true"
    />
  );
}

function EvoquestSpriteScene({ scene = "app", action = "idle" }) {
  return (
    <div className={`evoquestSpriteScene ${scene}Scene`} aria-hidden="true">
      <span className="spriteCoin">XP</span>
      <SpriteActor character="a" action={action} />
      <strong>{action === "victory" ? "LEVEL UP!" : "READY!"}</strong>
      <SpriteActor character="b" action={action} />
      <i className="spriteStage" />
    </div>
  );
}

function Auth({ back, done }) {
  const [login, setLogin] = useState(false),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      role: "student",
    }),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    if (!supabaseConfigured) {
      setStatus("Confira as variáveis do arquivo .env.");
      setBusy(false);
      return;
    }
    const r = login
      ? await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
      : await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name, account_type: form.role } },
        });
    setBusy(false);
    if (r.error) return setStatus(r.error.message);
    if (!login && !r.data.session)
      return setStatus("Conta criada! Confirme pelo e-mail enviado.");
    done();
  }
  return (
    <div className="authPage">
      <header>
        <Logo />
        <button className="ghost" onClick={back}>
          Voltar
        </button>
      </header>
      <form className="authCard" onSubmit={submit}>
        <span className="sectionTag">SUA JORNADA COMEÇA AQUI</span>
        <h1>{login ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
        {!login && (
          <>
            <label>
              Nome
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="roleChoice">
              <button
                type="button"
                className={form.role === "student" ? "active" : ""}
                onClick={() => setForm({ ...form, role: "student" })}
              >
                <UserRound />
                <b>Sou aluno</b>
                <small>Treinos, alimentação e evolução</small>
              </button>
              <button
                type="button"
                className={form.role === "trainer" ? "active" : ""}
                onClick={() => setForm({ ...form, role: "trainer" })}
              >
                <Dumbbell />
                <b>Sou personal</b>
                <small>Gerenciar e acompanhar alunos</small>
              </button>
            </div>
          </>
        )}
        <label>
          E-mail
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Senha
          <input
            required
            minLength="6"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {status && <div className="authMessage">{status}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Aguarde..." : login ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          className="switchAuth"
          onClick={() => {
            setLogin(!login);
            setStatus("");
          }}
        >
          {login ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [soundEnabled, toggleSound] = useArcadeAudio();
  const [screen, setScreen] = useState("home"),
    [step, setStep] = useState(0),
    [data, setData] = useState(blank),
    [assessmentId, setAssessmentId] = useState(null),
    [user, setUser] = useState(null),
    [role, setRole] = useState(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return setLoading(false);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const accountType = user.user_metadata?.account_type || "student";
      await supabase.from("app_profiles").upsert(
        {
          user_id: user.id,
          full_name: user.user_metadata?.name || "Usuário",
          role: accountType,
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
      const { data: profile } = await supabase
        .from("app_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      const currentRole = profile?.role || accountType;
      setRole(currentRole);
      if (currentRole === "trainer") {
        setScreen("dashboard");
        setLoading(false);
        return;
      }
      const { data: a } = await supabase
        .from("fitness_assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (a) {
        setAssessmentId(a.id);
        setData({
          goal: a.goal,
          place: a.training_place,
          days: a.training_days,
          level: a.experience_level,
          sex: a.biological_sex || "",
          age: a.age || "",
          height: a.height_cm || "",
          weight: a.weight_kg || "",
          restrictions: a.restrictions || "",
          equipment: a.equipment || "",
          activity: a.activity_level || "Moderadamente ativo",
          meals: a.meals_per_day || 4,
          diet: a.diet_preference || "Sem preferência",
          foodRestrictions: a.food_restrictions || "",
        });
        setScreen("dashboard");
      } else {
        setAssessmentId(null);
        setScreen("onboarding");
      }
      setLoading(false);
    })();
  }, [user]);
  const begin = () =>
    user ? (setStep(0), setScreen("onboarding")) : setScreen("auth");
  const logout = async () => {
    await supabase.auth.signOut();
    setScreen("home");
  };
  async function next() {
    if (step < 6) return setStep(step + 1);
    setSaving(true);
    setError("");
    const values = {
      user_id: user.id,
      goal: data.goal,
      training_place: data.place,
      training_days: data.days,
      experience_level: data.level,
      biological_sex: data.sex,
      age: +data.age,
      height_cm: +data.height,
      weight_kg: +data.weight,
      restrictions: data.restrictions,
      equipment: data.equipment,
      activity_level: data.activity,
      meals_per_day: +data.meals,
      diet_preference: data.diet,
      food_restrictions: data.foodRestrictions,
      updated_at: new Date().toISOString(),
    };
    const result = assessmentId
      ? await supabase
          .from("fitness_assessments")
          .update(values)
          .eq("id", assessmentId)
          .select("id")
          .single()
      : await supabase
          .from("fitness_assessments")
          .insert(values)
          .select("id")
          .single();
    setSaving(false);
    if (result.error)
      return setError(
        "Não foi possível salvar. Confirme se a atualização SQL foi executada.",
      );
    setAssessmentId(result.data.id);
    setScreen("dashboard");
  }
  if (loading)
    return (
      <div className="appLoading">
        <Logo /> Carregando...
      </div>
    );
  if (screen === "auth")
    return (
      <Auth
        back={() => setScreen("home")}
        done={() => setScreen("onboarding")}
      />
    );
  if (screen === "home")
    return (
      <main className="landingPage arcadeOfficial">
        <nav>
          <Logo />
          <div className="landingNavActions">
            <SettingsMenu enabled={soundEnabled} toggle={toggleSound} />
            <button
              className="ghost"
              onClick={() => setScreen(user ? "dashboard" : "auth")}
            >
              {user ? "Meu painel" : "Entrar"}
            </button>
          </div>
        </nav>
        <section className="hero">
          <div className="heroGameHud" aria-hidden="true">
            <span>PLAYER 01</span>
            <b>LV. 01</b>
            <i><em /></i>
            <small>0 / 100 XP</small>
          </div>
          <div className="evoquestNeonSign" aria-hidden="true">
            <span className="evoquestNeonSignWire wireLeft" />
            <span className="evoquestNeonSignWire wireRight" />
            <img
              src={`${import.meta.env.BASE_URL}branding/evoquest-neon-sign.png`}
              alt=""
              draggable="false"
            />
          </div>
          <div className="heroMainCopy">
            <div className="eyebrow">
              <Activity size={15} /> FASE 01 • SUA EVOLUÇÃO COMEÇA AQUI
            </div>
            <h1>
              Entre no jogo.
              <br />
              <em>Evolua de verdade.</em>
            </h1>
            <p>
              O EVOQUEST transforma treino, alimentação e progresso em uma jornada
              personalizada. Você informa seu objetivo; o jogo monta sua primeira missão.
            </p>
            <div className="actions">
              <button className="primary" onClick={begin}>
                Criar meu jogador <ArrowRight size={18} />
              </button>
              <span>PRIMEIRO ACESSO RÁPIDO • SEM CARTÃO</span>
            </div>
            <div className="firstAccessMini">
              <span><b>01</b> Objetivo</span>
              <i />
              <span><b>02</b> Avaliação</span>
              <i />
              <span><b>03</b> Primeira missão</span>
            </div>
          </div>
          <div className="gymStageActors" aria-hidden="true">
            <SpriteActor character="a" action="strength" />
            <span className="trainingModeLabel">TRAINING MODE</span>
            <SpriteActor character="b" action="strength" />
          </div>
          <div className="proof">
            <div>
              <b>100%</b>
              <small>personalizado</small>
            </div>
            <div>
              <b>7 dias</b>
              <small>para reavaliar</small>
            </div>
            <div>
              <b>1 jornada</b>
              <small>feita para você</small>
            </div>
          </div>
        </section>
        <section className="how" id="como">
          <span className="sectionTag">SIMPLES DE VERDADE</span>
          <h2>Da avaliação à evolução.</h2>
          <div className="cards">
            {[
              [Target, "Conte seu objetivo", "Corpo, rotina e preferências."],
              [Dumbbell, "Receba seu plano", "Treinos que cabem na sua vida."],
              [
                LineChart,
                "Evolua toda semana",
                "Progresso e ajustes inteligentes.",
              ],
            ].map(([I, t, d], i) => (
              <article key={t}>
                <span className="num">0{i + 1}</span>
                <I />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <footer>
          <Logo />
          <p>Movimento que acompanha você.</p>
        </footer>
      </main>
    );
  if (screen === "dashboard")
    return role === "trainer" ? (
      <TrainerPortal
        user={user}
        logout={logout}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
      />
    ) : (
      <Dashboard
        data={data}
        user={user}
        logout={logout}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
      />
    );
  const valid =
    step === 0
      ? data.goal
      : step === 1
        ? data.place
        : step === 4
          ? data.sex &&
            data.age >= 16 &&
            data.height >= 100 &&
            data.weight >= 30
          : true;
  return (
    <div className="flow">
      <header>
        <Logo />
        <span>Seu plano personalizado</span>
      </header>
      <div className="progress">
        {steps.map((s, i) => (
          <div className={i <= step ? "active" : ""} key={s}>
            <i>{i < step ? <Check size={13} /> : i + 1}</i>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <section className="question">
        <button
          className="back"
          onClick={() => (step ? setStep(step - 1) : setScreen("home"))}
        >
          <ChevronLeft size={18} /> Voltar
        </button>
        <div className="stepLabel">ETAPA {step + 1} DE 7</div>
        {step === 0 && (
          <>
            <h2>Qual transformação você busca?</h2>
            <p>Isso define a estratégia central do seu plano.</p>
            <div className="options">
              {goals.map(([t, d]) => (
                <button
                  className={data.goal === t ? "selected" : ""}
                  onClick={() => setData({ ...data, goal: t })}
                  key={t}
                >
                  <Target />
                  <span>
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                  {data.goal === t && <Check />}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Onde você vai treinar?</h2>
            <p>Adaptaremos os exercícios aos equipamentos disponíveis.</p>
            <div className="options compact">
              {[
                ["Academia", Dumbbell],
                ["Em casa", Home],
                ["Os dois", Activity],
              ].map(([t, I]) => (
                <button
                  className={data.place === t ? "selected" : ""}
                  onClick={() => setData({ ...data, place: t })}
                  key={t}
                >
                  <I />
                  <b>{t}</b>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Quantos dias por semana?</h2>
            <p>Escolha uma frequência sustentável.</p>
            <div className="days">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  className={data.days === n ? "selected" : ""}
                  onClick={() => setData({ ...data, days: n })}
                  key={n}
                >
                  <b>{n}</b>
                  <small>dias</small>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Qual é sua experiência?</h2>
            <p>Isso ajusta volume e intensidade.</p>
            <div className="options compact">
              {["Iniciante", "Intermediário", "Avançado"].map((t) => (
                <button
                  className={data.level === t ? "selected" : ""}
                  onClick={() => setData({ ...data, level: t })}
                  key={t}
                >
                  <UserRound />
                  <b>{t}</b>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Conte sobre seu corpo</h2>
            <p>
              Usaremos estes dados para personalizar estimativas e progressões.
            </p>
            <div className="fieldGrid">
              <label>
                Sexo biológico
                <select
                  value={data.sex}
                  onChange={(e) => setData({ ...data, sex: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option>Masculino</option>
                  <option>Feminino</option>
                  <option>Prefiro não informar</option>
                </select>
              </label>
              <label>
                Idade
                <input
                  type="number"
                  min="16"
                  max="100"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  placeholder="Ex.: 28"
                />
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={data.height}
                  onChange={(e) => setData({ ...data, height: e.target.value })}
                  placeholder="Ex.: 175"
                />
              </label>
              <label>
                Peso (kg)
                <input
                  type="number"
                  min="30"
                  max="500"
                  step=".1"
                  value={data.weight}
                  onChange={(e) => setData({ ...data, weight: e.target.value })}
                  placeholder="Ex.: 78,5"
                />
              </label>
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h2>Cuidados e equipamentos</h2>
            <p>
              Evite informações médicas detalhadas; descreva apenas limitações
              relevantes ao treino.
            </p>
            <div className="fieldGrid one">
              <label>
                Restrições ou limitações
                <textarea
                  maxLength="1000"
                  value={data.restrictions}
                  onChange={(e) =>
                    setData({ ...data, restrictions: e.target.value })
                  }
                  placeholder="Ex.: evitar impacto nos joelhos"
                />
              </label>
              <label>
                Equipamentos disponíveis
                <textarea
                  maxLength="1000"
                  value={data.equipment}
                  onChange={(e) =>
                    setData({ ...data, equipment: e.target.value })
                  }
                  placeholder="Ex.: halteres, elástico e banco"
                />
              </label>
            </div>
            <div className="notice">
              Em caso de dor, lesão, gestação ou condição clínica, procure
              avaliação profissional antes de iniciar o plano.
            </div>
          </>
        )}
        {step === 6 && (
          <>
            <h2>Como é sua alimentação?</h2>
            <p>
              Essas escolhas ajustam as estimativas e as sugestões do seu dia.
            </p>
            <div className="fieldGrid">
              <label>
                Nível de atividade
                <select
                  value={data.activity}
                  onChange={(e) =>
                    setData({ ...data, activity: e.target.value })
                  }
                >
                  <option>Pouco ativo</option>
                  <option>Levemente ativo</option>
                  <option>Moderadamente ativo</option>
                  <option>Muito ativo</option>
                </select>
              </label>
              <label>
                Refeições por dia
                <select
                  value={data.meals}
                  onChange={(e) => setData({ ...data, meals: +e.target.value })}
                >
                  <option value="3">3 refeições</option>
                  <option value="4">4 refeições</option>
                  <option value="5">5 refeições</option>
                  <option value="6">6 refeições</option>
                </select>
              </label>
              <label>
                Preferência alimentar
                <select
                  value={data.diet}
                  onChange={(e) => setData({ ...data, diet: e.target.value })}
                >
                  <option>Sem preferência</option>
                  <option>Vegetariana</option>
                  <option>Vegana</option>
                </select>
              </label>
              <label>
                Restrições, alergias ou alimentos evitados
                <input
                  maxLength="500"
                  value={data.foodRestrictions}
                  onChange={(e) =>
                    setData({ ...data, foodRestrictions: e.target.value })
                  }
                  placeholder="Ex.: lactose, amendoim, peixe"
                />
              </label>
            </div>
            <div className="notice">
              A EVOQUEST não cria dieta terapêutica. Em caso de alergia, diabetes,
              doença renal, gestação ou outra condição clínica, procure
              nutricionista ou médico.
            </div>
          </>
        )}
        {error && <div className="formError">{error}</div>}
        <button
          className="primary continue"
          disabled={saving || !valid}
          onClick={next}
        >
          {saving
            ? "Salvando..."
            : step === 6
              ? "Salvar e ver plano"
              : "Continuar"}{" "}
          {!saving && <ArrowRight size={18} />}
        </button>
      </section>
    </div>
  );
}

function makeWorkout(data) {
  const home = data.place === "Em casa";
  const exercises = home
    ? [
        "Agachamento livre",
        "Flexão de braços",
        "Remada com elástico ou mochila",
        "Elevação pélvica",
        "Prancha",
      ]
    : [
        "Agachamento guiado",
        "Supino com halteres",
        "Puxada frontal",
        "Levantamento romeno",
        "Desenvolvimento de ombros",
      ];
  const detail =
    data.goal === "Ganhar massa"
      ? "3 séries × 8–12 repetições"
      : data.goal === "Emagrecer"
        ? "3 séries × 12–15 repetições"
        : "3 séries × 10–12 repetições";
  return {
    title:
      data.days <= 3
        ? "Treino de corpo inteiro"
        : "Treino A — membros superiores",
    minutes: data.level === "Iniciante" ? 40 : 50,
    exercises: exercises
      .slice(0, data.level === "Iniciante" ? 4 : 5)
      .map((name, i) => ({
        name,
        detail: i === exercises.length - 1 ? "3 séries controladas" : detail,
      })),
  };
}
function DashboardLegacy({ data, user, restart, logout }) {
  const name = user?.user_metadata?.name || "Atleta",
    workout = makeWorkout(data);
  return (
    <div className="dash studentDash">
      <aside>
        <Logo />
        <div className="menu">
          <button className="current">
            <Home />
            Visão geral
          </button>
          <button>
            <Dumbbell />
            Treinos
          </button>
          <button>
            <Salad />
            Alimentação
          </button>
          <button
            className={tab === "progress" ? "current" : ""}
            onClick={() => setTab("progress")}
          >
            <LineChart />
            Progresso
          </button>
          <button onClick={restart}>
            <UserRound />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={restart}>
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>{data.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header>
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>Vamos continuar, {name}.</h1>
          </div>
          <button className="editProfile" onClick={restart}>
            Editar perfil
          </button>
        </header>
        <div className="summary">
          <div>
            <small>OBJETIVO</small>
            <b>{data.goal || "Crie seu plano"}</b>
            <span>
              <Target />
              Plano ativo
            </span>
          </div>
          <div>
            <small>ROTINA</small>
            <b>{data.days}x por semana</b>
            <span>
              <Dumbbell />
              {data.place || "A definir"}
            </span>
          </div>
          <div>
            <small>PERFIL</small>
            <b>{data.weight ? data.weight + " kg" : "Complete a avaliação"}</b>
            <span>
              <Activity />
              {data.level}
            </span>
          </div>
        </div>
        <section className="today">
          <div className="todayHead">
            <div>
              <span>HOJE • TREINO PERSONALIZADO</span>
              <h2>{workout.title}</h2>
            </div>
            <b>{workout.minutes} min</b>
          </div>
          {workout.exercises.map((exercise, i) => (
            <div className="exercise" key={exercise.name}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{exercise.name}</b>
                <small>{exercise.detail}</small>
              </div>
              {i === 0 ? <Check /> : <div className="openDot" />}
            </div>
          ))}
        </section>
        {data.restrictions && (
          <div className="safetyNote">
            <b>Atenção às suas limitações</b>
            <span>{data.restrictions}</span>
          </div>
        )}
        <p className="disclaimer">
          A EVOQUEST oferece orientação educativa e não substitui profissionais de
          saúde.
        </p>
      </div>
    </div>
  );
}
function buildWeeklyPlan(data) {
  const home = data.place === "Em casa";
  const { value: bmi } = calculateBmi(data);
  const variant = profileVariant(data);
  const sets = data.level === "Iniciante" || Number(data.age) >= 55 ? 3 : 4;
  const reps =
    data.goal === "Ganhar massa"
      ? bmi < 18.5
        ? "6–10"
        : bmi >= 30
          ? "10–15"
          : "8–12"
      : data.goal === "Emagrecer"
        ? "12–15"
        : "10–12";
  const rest = data.goal === "Emagrecer" ? "45–60 s" : "60–90 s";
  const gymVariants = [
  {
    push: [
      "Supino com halteres",
      "Desenvolvimento de ombros",
      "Tríceps na polia",
      "Elevação lateral",
    ],
    pull: ["Puxada frontal", "Remada sentada", "Rosca direta", "Face pull"],
    legs: [
      "Agachamento livre",
      "Leg press",
      "Cadeira flexora",
      "Panturrilha em pé",
    ],
    full: [
      "Agachamento goblet",
      "Supino com halteres",
      "Remada sentada",
      "Levantamento terra romeno",
    ],
  },
  {
    push: ["Supino máquina", "Desenvolvimento com halteres", "Tríceps francês", "Crucifixo máquina"],
    pull: ["Remada cavalinho", "Puxada neutra", "Rosca martelo", "Crucifixo inverso"],
    legs: ["Leg press", "Cadeira extensora", "Mesa flexora", "Elevação pélvica"],
    full: ["Leg press", "Supino máquina", "Puxada neutra", "Elevação pélvica"],
  },
  {
    push: ["Supino inclinado", "Desenvolvimento máquina", "Tríceps corda", "Elevação lateral"],
    pull: ["Remada unilateral", "Puxada supinada", "Rosca alternada", "Face pull"],
    legs: ["Agachamento goblet", "Afundo no smith", "Cadeira flexora", "Panturrilha sentada"],
    full: ["Agachamento goblet", "Supino inclinado", "Remada unilateral", "Levantamento romeno"],
  }];
  const houseVariants = [{
    push: [
      "Flexão de braços",
      "Desenvolvimento com mochila",
      "Tríceps no banco",
      "Elevação lateral com garrafas",
    ],
    pull: [
      "Remada com mochila",
      "Remada unilateral apoiada",
      "Rosca com elástico ou mochila",
      "Crucifixo inverso",
    ],
    legs: [
      "Agachamento livre",
      "Afundo alternado",
      "Ponte de glúteos",
      "Panturrilha unilateral",
    ],
    full: [
      "Agachamento livre",
      "Flexão de braços",
      "Remada com mochila",
      "Levantamento romeno com mochila",
    ],
  }, {
    push: ["Flexão inclinada", "Desenvolvimento com elástico", "Tríceps com elástico", "Elevação lateral com garrafas"],
    pull: ["Remada unilateral com mochila", "Puxada com elástico", "Rosca com mochila", "Crucifixo inverso com elástico"],
    legs: ["Agachamento com mochila", "Afundo reverso", "Elevação pélvica unilateral", "Panturrilha em degrau"],
    full: ["Agachamento com mochila", "Flexão inclinada", "Remada unilateral com mochila", "Elevação pélvica"],
  }, {
    push: ["Flexão de joelhos ou completa", "Desenvolvimento com mochila", "Tríceps testa com elástico", "Elevação frontal"],
    pull: ["Remada curvada com mochila", "Pullover com elástico", "Rosca martelo com garrafas", "Superman"],
    legs: ["Agachamento sumô", "Passada estacionária", "Ponte de glúteos", "Panturrilha unilateral"],
    full: ["Agachamento sumô", "Flexão de joelhos ou completa", "Remada curvada com mochila", "Ponte de glúteos"],
  }];
  const bank = home ? houseVariants[variant] : gymVariants[variant];
  const short = [
    ["A", "Corpo inteiro", bank.full],
    ["B", "Pernas e core", bank.legs],
    [
      "C",
      "Parte superior",
      [...bank.push.slice(0, 2), ...bank.pull.slice(0, 2)],
    ],
  ];
  const long = [
    ["A", "Empurrar", bank.push],
    ["B", "Puxar", bank.pull],
    ["C", "Pernas", bank.legs],
    ["D", "Corpo inteiro", bank.full],
    [
      "E",
      "Superior misto",
      [bank.push[0], bank.pull[0], bank.push[1], bank.pull[1]],
    ],
    ["F", "Pernas e condicionamento", bank.legs],
  ];
  return (data.days <= 3 ? short : long)
    .slice(0, Number(data.days) || 3)
    .map(([id, title, items], index) => ({
      id,
      title,
      day: `Dia ${index + 1}`,
      items: items.map((name) => ({
        name,
        detail: `${sets} séries × ${reps} • descanso ${rest}`,
      })),
    }));
}

function DashboardV06({ data, user, restart, logout }) {
  const name = user?.user_metadata?.name || "Atleta";
  const [tab, setTab] = useState("overview");
  const plan = buildWeeklyPlan(data),
    current = plan[0];
  return (
    <div className="dash studentDash">
      <aside>
        <Logo />
        <div className="menu">
          <button
            className={tab === "overview" ? "current" : ""}
            onClick={() => setTab("overview")}
          >
            <Home />
            Visão geral
          </button>
          <button
            className={tab === "workouts" ? "current" : ""}
            onClick={() => setTab("workouts")}
          >
            <Dumbbell />
            Treinos
          </button>
          <button>
            <Salad />
            Alimentação
          </button>
          <button
            className={tab === "progress" ? "current" : ""}
            onClick={() => setTab("progress")}
          >
            <LineChart />
            Progresso
          </button>
          <button onClick={restart}>
            <UserRound />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={restart}>
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>{data.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header>
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>
              {tab === "workouts"
                ? "Seu plano de treinos"
                : `Vamos continuar, ${name}.`}
            </h1>
          </div>
          <button className="editProfile" onClick={restart}>
            Atualizar avaliação
          </button>
        </header>
        {data.restrictions && (
          <div className="safetyAlert">
            <AlertTriangle />
            <div>
              <b>Atenção às limitações informadas</b>
              <span>
                Adapte os movimentos e procure um profissional antes de treinar
                se houver dor, lesão ou condição clínica.
              </span>
            </div>
          </div>
        )}
        {tab === "overview" ? (
          <>
            <div className="summary">
              <div>
                <small>OBJETIVO</small>
                <b>{data.goal}</b>
                <span>
                  <Target />
                  Plano ativo
                </span>
              </div>
              <div>
                <small>ROTINA</small>
                <b>{data.days}x por semana</b>
                <span>
                  <Dumbbell />
                  {data.place}
                </span>
              </div>
              <div>
                <small>PERFIL</small>
                <b>{data.weight} kg</b>
                <span>
                  <Activity />
                  {data.level}
                </span>
              </div>
            </div>
            <section className="today">
              <div className="todayHead">
                <div>
                  <span>PRÓXIMO • TREINO {current.id}</span>
                  <h2>{current.title}</h2>
                </div>
                <b>40–55 min</b>
              </div>
              {current.items.map((item, i) => (
                <div className="exercise" key={item.name}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <b>{item.name}</b>
                    <small>{item.detail}</small>
                  </div>
                  <div className="openDot" />
                </div>
              ))}
              <button className="primary" onClick={() => setTab("workouts")}>
                Ver plano completo <ArrowRight size={17} />
              </button>
            </section>
          </>
        ) : (
          <section className="workoutPlan">
            <div className="planIntro">
              <p>
                Plano para <b>{data.goal.toLowerCase()}</b>, nível{" "}
                <b>{data.level.toLowerCase()}</b>, com treinos{" "}
                {data.place === "Os dois"
                  ? "em casa ou na academia"
                  : data.place.toLowerCase()}
                .
              </p>
              <span>{data.days} treinos por semana</span>
            </div>
            <div className="workoutGrid">
              {plan.map((workout) => (
                <article className="workoutCard" key={workout.id}>
                  <div className="workoutTitle">
                    <span>{workout.day}</span>
                    <b>Treino {workout.id}</b>
                    <h2>{workout.title}</h2>
                  </div>
                  {workout.items.map((item, i) => (
                    <div className="workoutItem" key={item.name}>
                      <i>{i + 1}</i>
                      <div>
                        <b>{item.name}</b>
                        <small>{item.detail}</small>
                      </div>
                    </div>
                  ))}
                </article>
              ))}
            </div>
            <div className="planNote">
              Faça 5–8 minutos de aquecimento. Interrompa o exercício se sentir
              dor aguda, tontura ou mal-estar.
            </div>
          </section>
        )}
        <p className="disclaimer">
          A EVOQUEST oferece orientação educativa e não substitui profissionais de
          saúde.
        </p>
      </div>
    </div>
  );
}

function calculateNutrition(data) {
  return calculateNutritionTargets(data);
}

function calculateHydration(data) {
  const weight = Math.max(30, Number(data.weight) || 70),
    factor = data.goal === "Ganhar massa" ? 40 : data.goal === "Emagrecer" ? 37 : 35;
  return Math.max(1500, Math.round((weight * factor) / 500) * 500);
}

function mealOptions(diet) {
  const vegan = diet === "Vegana",
    vegetarian = diet === "Vegetariana";
  return [
    {
      name: "Café da manhã",
      choices: vegan
        ? [
            "Aveia com bebida vegetal, banana e chia",
            "Pão integral, homus e fruta",
            "Tofu mexido com pão integral",
          ]
        : vegetarian
          ? [
              "Iogurte, aveia, banana e chia",
              "Omelete com pão integral e fruta",
              "Tapioca com queijo e fruta",
            ]
          : [
              "Ovos, pão integral e fruta",
              "Iogurte, aveia e banana",
              "Tapioca com frango e fruta",
            ],
    },
    {
      name: "Almoço",
      choices: vegan
        ? [
            "Arroz, feijão, tofu e salada",
            "Quinoa, lentilha e legumes",
            "Macarrão integral com proteína de soja",
          ]
        : vegetarian
          ? [
              "Arroz, feijão, ovos e salada",
              "Quinoa, grão-de-bico e legumes",
              "Macarrão integral com tofu",
            ]
          : [
              "Arroz, feijão, frango e salada",
              "Batata, carne magra e legumes",
              "Macarrão integral com atum e salada",
            ],
    },
    {
      name: "Lanche",
      choices: vegan
        ? [
            "Fruta, castanhas e proteína vegetal",
            "Sanduíche de homus",
            "Vitamina com bebida vegetal",
          ]
        : vegetarian
          ? [
              "Iogurte com fruta e aveia",
              "Sanduíche de queijo branco",
              "Vitamina de banana",
            ]
          : [
              "Iogurte com fruta e aveia",
              "Sanduíche de frango",
              "Fruta com pasta de amendoim",
            ],
    },
    {
      name: "Jantar",
      choices: vegan
        ? [
            "Bowl de grão-de-bico e legumes",
            "Sopa de lentilha com torradas",
            "Arroz, feijão e tofu grelhado",
          ]
        : vegetarian
          ? [
              "Omelete com legumes e arroz",
              "Sopa de lentilha com torradas",
              "Arroz, feijão e tofu grelhado",
            ]
          : [
              "Frango, batata e legumes",
              "Omelete com arroz e salada",
              "Peixe, arroz e vegetais",
            ],
    },
    {
      name: "Ceia",
      choices: vegan
        ? [
            "Fruta com sementes",
            "Bebida vegetal com aveia",
            "Homus com cenoura",
          ]
        : vegetarian
          ? ["Iogurte natural", "Leite com aveia", "Queijo branco e fruta"]
          : ["Iogurte natural", "Leite com aveia", "Ovos cozidos e fruta"],
    },
    {
      name: "Lanche extra",
      choices: [
        "Fruta e uma fonte de proteína",
        "Sanduíche integral simples",
        "Aveia com fruta",
      ],
    },
  ];
}

function NutritionPlanV12({ data }) {
  const targets = calculateNutrition(data);
  const meals = mealOptions(data.diet).slice(0, Number(data.meals) || 4);
  const [choices, setChoices] = useState({});
  const swap = (i) =>
    setChoices({
      ...choices,
      [i]: ((choices[i] || 0) + 1) % meals[i].choices.length,
    });
  return (
    <section className="nutritionPage">
      <div className="macroGrid">
        <article>
          <small>ENERGIA DIÁRIA</small>
          <b>{targets.calories}</b>
          <span>kcal estimadas</span>
        </article>
        <article>
          <small>PROTEÍNAS</small>
          <b>{targets.protein} g</b>
          <span>por dia</span>
        </article>
        <article>
          <small>CARBOIDRATOS</small>
          <b>{targets.carbs} g</b>
          <span>por dia</span>
        </article>
        <article>
          <small>GORDURAS</small>
          <b>{targets.fat} g</b>
          <span>por dia</span>
        </article>
      </div>
      <div className="hydration">
        <div>
          <Salad />
          <span>
            <b>Meta de hidratação</b>
            <small>
              Aproximadamente {targets.water / 1000} L de água ao longo do dia
            </small>
          </span>
        </div>
        <i style={{ width: `${Math.min(100, targets.water / 35)}%` }} />
      </div>
      {data.foodRestrictions && (
        <div className="foodAlert">
          <AlertTriangle />
          <div>
            <b>Restrições informadas: {data.foodRestrictions}</b>
            <span>
              Confira sempre os rótulos e troque qualquer sugestão incompatível.
              O sistema não valida alérgenos automaticamente.
            </span>
          </div>
        </div>
      )}
      <div className="mealHeader">
        <div>
          <span>PLANO ALIMENTAR FLEXÍVEL</span>
          <h2>{meals.length} refeições para organizar seu dia</h2>
        </div>
        <p>Use as trocas para variar mantendo uma estrutura semelhante.</p>
      </div>
      <div className="mealGrid">
        {meals.map((meal, i) => (
          <article className="mealCard" key={meal.name}>
            <div>
              <i>{String(i + 1).padStart(2, "0")}</i>
              <span>
                <b>{meal.name}</b>
                <small>
                  {Math.round(targets.calories / meals.length)} kcal como
                  referência
                </small>
              </span>
            </div>
            <p>{meal.choices[choices[i] || 0]}</p>
            <button onClick={() => swap(i)}>Trocar opção</button>
          </article>
        ))}
      </div>
      <div className="nutritionGuide">
        <b>Como usar este plano</b>
        <p>
          Monte pratos com uma fonte de proteína, carboidrato, vegetais e
          gordura em quantidades compatíveis com sua fome e sua meta. Os valores
          são estimativas iniciais, não uma prescrição nutricional.
        </p>
      </div>
    </section>
  );
}

function DashboardV08({ data, user, restart, logout }) {
  const name = user?.user_metadata?.name || "Atleta";
  const [tab, setTab] = useState("overview");
  const plan = buildWeeklyPlan(data),
    current = plan[0];
  let content;
  if (tab === "progress") content = <ProgressPage user={user} data={data} />;
  else if (tab === "nutrition")
    content = <NutritionPlan data={data} user={user} />;
  else if (tab === "workouts")
    content = (
      <section className="workoutPlan">
        <div className="planIntro">
          <p>
            Plano para <b>{data.goal.toLowerCase()}</b>, nível{" "}
            <b>{data.level.toLowerCase()}</b>, com treinos{" "}
            {data.place === "Os dois"
              ? "em casa ou na academia"
              : data.place.toLowerCase()}
            .
          </p>
          <span>{data.days} treinos por semana</span>
        </div>
        <div className="workoutGrid">
          {plan.map((workout) => (
            <article className="workoutCard" key={workout.id}>
              <div className="workoutTitle">
                <span>{workout.day}</span>
                <b>Treino {workout.id}</b>
                <h2>{workout.title}</h2>
              </div>
              {workout.items.map((item, i) => (
                <div className="workoutItem" key={item.name}>
                  <i>{i + 1}</i>
                  <div>
                    <b>{item.name}</b>
                    <small>{item.detail}</small>
                  </div>
                </div>
              ))}
            </article>
          ))}
        </div>
        <div className="planNote">
          Faça 5–8 minutos de aquecimento. Interrompa o exercício se sentir dor
          aguda, tontura ou mal-estar.
        </div>
      </section>
    );
  else
    content = (
      <>
        <div className="summary">
          <div>
            <small>OBJETIVO</small>
            <b>{data.goal}</b>
            <span>
              <Target />
              Plano ativo
            </span>
          </div>
          <div>
            <small>ROTINA</small>
            <b>{data.days}x por semana</b>
            <span>
              <Dumbbell />
              {data.place}
            </span>
          </div>
          <div>
            <small>ALIMENTAÇÃO</small>
            <b>{calculateNutrition(data).calories} kcal</b>
            <span>
              <Salad />
              {data.diet}
            </span>
          </div>
        </div>
        <section className="today">
          <div className="todayHead">
            <div>
              <span>PRÓXIMO • TREINO {current.id}</span>
              <h2>{current.title}</h2>
            </div>
            <b>40–55 min</b>
          </div>
          {current.items.map((item, i) => (
            <div className="exercise" key={item.name}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </div>
              <div className="openDot" />
            </div>
          ))}
          <button className="primary" onClick={() => setTab("workouts")}>
            Ver plano completo <ArrowRight size={17} />
          </button>
        </section>
      </>
    );
  return (
    <div className="dash">
      <aside>
        <Logo />
        <div className="menu">
          <button
            className={tab === "overview" ? "current" : ""}
            onClick={() => setTab("overview")}
          >
            <Home />
            Visão geral
          </button>
          <button
            className={tab === "workouts" ? "current" : ""}
            onClick={() => setTab("workouts")}
          >
            <Dumbbell />
            Treinos
          </button>
          <button
            className={tab === "nutrition" ? "current" : ""}
            onClick={() => setTab("nutrition")}
          >
            <Salad />
            Alimentação
          </button>
          <button
            className={tab === "progress" ? "current" : ""}
            onClick={() => setTab("progress")}
          >
            <LineChart />
            Progresso
          </button>
          <button onClick={restart}>
            <UserRound />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={restart}>
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>{data.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header>
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>
              {tab === "progress"
                ? "Seu progresso"
                : tab === "nutrition"
                  ? "Sua alimentação"
                  : tab === "workouts"
                    ? "Seus treinos"
                    : `Vamos continuar, ${name}.`}
            </h1>
          </div>
          <button className="editProfile" onClick={restart}>
            Atualizar avaliação
          </button>
        </header>
        {content}
        <p className="disclaimer">
          Estimativas educativas. A EVOQUEST não substitui nutricionista, médico ou
          profissional de educação física.
        </p>
      </div>
    </div>
  );
}

function ProgressChart({ records }) {
  if (records.length < 2)
    return (
      <div className="emptyChart">
        <LineChart />
        <b>Seu gráfico aparecerá aqui</b>
        <span>
          Adicione pelo menos dois registros para visualizar a evolução.
        </span>
      </div>
    );
  const values = records.map((r) => Number(r.weight_kg)),
    min = Math.min(...values) - 1,
    max = Math.max(...values) + 1,
    range = max - min || 1;
  const coords = records.map((r, i) => ({
      x: 8 + (i / (records.length - 1)) * 84,
      y: 82 - ((Number(r.weight_kg) - min) / range) * 64,
    })),
    points = coords.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div className="progressChart">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="Evolução do peso"
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity=".35" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="8" y1="82" x2="92" y2="82" />
        <polygon points={`8,82 ${points} 92,82`} fill="url(#area)" />
        <polyline points={points} />
        {coords.map((p, i) => (
          <circle key={records[i].id} cx={p.x} cy={p.y} r="1.8" />
        ))}
      </svg>
      <div className="chartLabels">
        <span>
          {new Date(records[0].recorded_at + "T12:00").toLocaleDateString(
            "pt-BR",
            { day: "2-digit", month: "short" },
          )}
        </span>
        <b>Peso em kg</b>
        <span>
          {new Date(records.at(-1).recorded_at + "T12:00").toLocaleDateString(
            "pt-BR",
            { day: "2-digit", month: "short" },
          )}
        </span>
      </div>
    </div>
  );
}

function ProgressPage({ user, data }) {
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState([]),
    [form, setForm] = useState({
      weight: data.weight || "",
      waist: "",
      date: today,
      notes: "",
    }),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("progress_records")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true });
    setRecords(rows || []);
    if (error) setMessage("Não foi possível carregar o histórico.");
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("progress_records").insert({
      user_id: user.id,
      weight_kg: +form.weight,
      waist_cm: form.waist ? +form.waist : null,
      recorded_at: form.date,
      notes: form.notes,
    });
    setSaving(false);
    if (error) return setMessage("Não foi possível salvar o registro.");
    setForm({ ...form, waist: "", notes: "" });
    setMessage("Progresso registrado com sucesso.");
    load();
  }
  async function remove(id) {
    if (!window.confirm("Excluir este registro?")) return;
    const { error } = await supabase
      .from("progress_records")
      .delete()
      .eq("id", id);
    if (!error) load();
  }
  const first = records[0],
    last = records.at(-1),
    change =
      first && last
        ? (Number(last.weight_kg) - Number(first.weight_kg)).toFixed(1)
        : null;
  return (
    <section className="progressPage">
      <div className="progressTop">
        <form className="progressForm" onSubmit={save}>
          <span>NOVO REGISTRO</span>
          <h2>Como você está hoje?</h2>
          <div className="progressFields">
            <label>
              Peso (kg)
              <input
                required
                type="number"
                min="30"
                max="500"
                step=".1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </label>
            <label>
              Cintura (cm)
              <input
                type="number"
                min="20"
                max="400"
                step=".1"
                value={form.waist}
                onChange={(e) => setForm({ ...form, waist: e.target.value })}
              />
            </label>
            <label>
              Data
              <input
                required
                type="date"
                max={today}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
          </div>
          <label>
            Observação
            <textarea
              maxLength="1000"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex.: energia melhor, treino consistente..."
            />
          </label>
          {message && <div className="progressMessage">{message}</div>}
          <button className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Registrar progresso"}
          </button>
        </form>
        <div className="progressStats">
          <article>
            <small>ÚLTIMO PESO</small>
            <b>{last ? `${last.weight_kg} kg` : "—"}</b>
            <span>{last ? "Registro mais recente" : "Sem registros"}</span>
          </article>
          <article>
            <small>EVOLUÇÃO TOTAL</small>
            <b>
              {change === null
                ? "—"
                : `${Number(change) > 0 ? "+" : ""}${change} kg`}
            </b>
            <span>Desde o primeiro registro</span>
          </article>
          <article>
            <small>REGISTROS</small>
            <b>{records.length}</b>
            <span>Check-ins realizados</span>
          </article>
        </div>
      </div>
      <div className="chartCard">
        <div>
          <span>EVOLUÇÃO DO PESO</span>
          <h2>Sua trajetória</h2>
        </div>
        {loading ? (
          <div className="chartLoading">Carregando histórico...</div>
        ) : (
          <ProgressChart records={records} />
        )}
      </div>
      <div className="historyCard">
        <div className="historyTitle">
          <h2>Histórico</h2>
          <span>{records.length} registros</span>
        </div>
        {!records.length && !loading ? (
          <p className="emptyHistory">Seu primeiro registro aparecerá aqui.</p>
        ) : (
          [...records].reverse().map((r) => (
            <div className="historyRow" key={r.id}>
              <div className="historyDate">
                <b>
                  {new Date(r.recorded_at + "T12:00").toLocaleDateString(
                    "pt-BR",
                    { day: "2-digit", month: "short" },
                  )}
                </b>
                <small>
                  {new Date(r.recorded_at + "T12:00").getFullYear()}
                </small>
              </div>
              <div>
                <b>{r.weight_kg} kg</b>
                <small>
                  {r.waist_cm
                    ? `Cintura: ${r.waist_cm} cm`
                    : "Cintura não informada"}
                </small>
              </div>
              <p>{r.notes || "Sem observações"}</p>
              <button onClick={() => remove(r.id)}>Excluir</button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function checkinAdvice(form, data) {
  const completed = Number(form.completed),
    planned = Number(data.days) || 3,
    ratio = completed / planned;
  let title = "Mantenha o plano nesta semana",
    text =
      "Seu ritmo está equilibrado. Continue com a mesma frequência e priorize consistência.";
  if (form.pain === "Sim")
    return {
      tone: "alert",
      title: "Pause os ajustes e cuide do desconforto",
      text: "Evite movimentos que provoquem dor e procure avaliação profissional. A EVOQUEST não aumenta o treino quando há desconforto.",
    };
  if (Number(form.energy) <= 2 || Number(form.sleep) <= 2)
    return {
      tone: "rest",
      title: "Semana de recuperação",
      text: "Reduza esforço e volume em cerca de 20%, mantenha movimentos leves e priorize sono e recuperação.",
    };
  if (ratio < 0.6)
    return {
      tone: "focus",
      title: "Simplifique para ganhar consistência",
      text: `Planeje ${Math.max(2, completed + 1)} treinos realistas nesta semana. Não compense sessões perdidas com excesso de volume.`,
    };
  if (Number(form.difficulty) >= 5)
    return {
      tone: "rest",
      title: "Ajuste a intensidade",
      text: "Reduza cargas ou repetições em aproximadamente 10% e preserve a técnica antes de progredir.",
    };
  if (ratio >= 0.9 && Number(form.energy) >= 4 && Number(form.difficulty) <= 3)
    return {
      tone: "progress",
      title: "Pronto para uma progressão leve",
      text: "Aumente apenas uma variável: 1–2 repetições ou até 5% de carga nos exercícios bem executados.",
    };
  if (Number(form.adherence) <= 2)
    return {
      tone: "focus",
      title: "Facilite a alimentação",
      text: "Escolha duas refeições-base simples para repetir durante a semana e evite mudanças radicais.",
    };
  return { tone: "good", title, text };
}

function Scale({ label, value, onChange }) {
  return (
    <label className="scaleField">
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            className={Number(value) === n ? "selected" : ""}
            onClick={() => onChange(n)}
            key={n}
          >
            {n}
          </button>
        ))}
      </div>
      <small>1 = baixo • 5 = excelente/intenso</small>
    </label>
  );
}

function CheckinPage({ user, data }) {
  const initial = {
    completed: Math.min(Number(data.days) || 3, 3),
    energy: 3,
    sleep: 3,
    adherence: 3,
    difficulty: 3,
    pain: "Não",
    notes: "",
  };
  const [form, setForm] = useState(initial),
    [history, setHistory] = useState([]),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const advice = checkinAdvice(form, data);
  async function load() {
    const { data: rows } = await supabase
      .from("weekly_checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false });
    setHistory(rows || []);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const week = monday.toISOString().slice(0, 10);
    const result = await supabase.from("weekly_checkins").upsert(
      {
        user_id: user.id,
        week_start: week,
        workouts_completed: +form.completed,
        energy: +form.energy,
        sleep_quality: +form.sleep,
        nutrition_adherence: +form.adherence,
        training_difficulty: +form.difficulty,
        pain_or_discomfort: form.pain === "Sim",
        notes: form.notes,
        recommendation_title: advice.title,
        recommendation_text: advice.text,
      },
      { onConflict: "user_id,week_start" },
    );
    setSaving(false);
    if (result.error)
      return setMessage(
        "Não foi possível salvar. Confirme se a migração SQL foi executada.",
      );
    setMessage("Check-in semanal salvo.");
    load();
  }
  return (
    <section className="checkinPage">
      <div className="checkinGrid">
        <form className="checkinForm" onSubmit={save}>
          <span>CHECK-IN DA SEMANA</span>
          <h2>Como foi sua rotina?</h2>
          <label>
            Treinos concluídos
            <select
              value={form.completed}
              onChange={(e) => setForm({ ...form, completed: +e.target.value })}
            >
              {Array.from({ length: (Number(data.days) || 3) + 1 }, (_, i) => (
                <option value={i} key={i}>
                  {i} de {data.days}
                </option>
              ))}
            </select>
          </label>
          <Scale
            label="Energia e disposição"
            value={form.energy}
            onChange={(v) => setForm({ ...form, energy: v })}
          />
          <Scale
            label="Qualidade do sono"
            value={form.sleep}
            onChange={(v) => setForm({ ...form, sleep: v })}
          />
          <Scale
            label="Adesão à alimentação"
            value={form.adherence}
            onChange={(v) => setForm({ ...form, adherence: v })}
          />
          <Scale
            label="Dificuldade dos treinos"
            value={form.difficulty}
            onChange={(v) => setForm({ ...form, difficulty: v })}
          />
          <label>
            Sentiu dor ou desconforto?
            <select
              value={form.pain}
              onChange={(e) => setForm({ ...form, pain: e.target.value })}
            >
              <option>Não</option>
              <option>Sim</option>
            </select>
          </label>
          <label>
            Observações
            <textarea
              maxLength="1000"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Conte o que ajudou ou dificultou sua semana."
            />
          </label>
          {message && <div className="progressMessage">{message}</div>}
          <button className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Concluir check-in"}
          </button>
        </form>
        <div>
          <article className={`adviceCard ${advice.tone}`}>
            <Activity />
            <span>RECOMENDAÇÃO DA EVOQUEST</span>
            <h2>{advice.title}</h2>
            <p>{advice.text}</p>
            {form.pain === "Sim" && (
              <b>Dor persistente ou intensa exige avaliação profissional.</b>
            )}
          </article>
          <div className="checkinSummary">
            <div>
              <small>TREINOS</small>
              <b>
                {form.completed}/{data.days}
              </b>
            </div>
            <div>
              <small>ENERGIA</small>
              <b>{form.energy}/5</b>
            </div>
            <div>
              <small>SONO</small>
              <b>{form.sleep}/5</b>
            </div>
          </div>
        </div>
      </div>
      <div className="checkinHistory">
        <div className="historyTitle">
          <h2>Check-ins anteriores</h2>
          <span>{history.length} semanas</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((item) => (
            <article key={item.id}>
              <div>
                <b>
                  Semana de{" "}
                  {new Date(item.week_start + "T12:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </b>
                <small>
                  {item.workouts_completed} treinos • energia {item.energy}/5 •
                  sono {item.sleep_quality}/5
                </small>
              </div>
              <p>{item.recommendation_title}</p>
            </article>
          ))
        ) : (
          <p className="emptyHistory">Seu primeiro check-in aparecerá aqui.</p>
        )}
      </div>
    </section>
  );
}

function DashboardV09({ data, user, restart, logout }) {
  const name = user?.user_metadata?.name || "Atleta";
  const [tab, setTab] = useState("overview");
  const plan = buildWeeklyPlan(data),
    current = plan[0];
  let content;
  if (tab === "checkin") content = <CheckinPage user={user} data={data} />;
  else if (tab === "progress")
    content = <ProgressPage user={user} data={data} />;
  else if (tab === "nutrition")
    content = <NutritionPlan data={data} user={user} />;
  else if (tab === "workouts")
    content = (
      <section className="workoutPlan">
        <div className="planIntro">
          <p>
            Plano para <b>{data.goal.toLowerCase()}</b>, nível{" "}
            <b>{data.level.toLowerCase()}</b>, com treinos{" "}
            {data.place === "Os dois"
              ? "em casa ou na academia"
              : data.place.toLowerCase()}
            .
          </p>
          <span>{data.days} treinos por semana</span>
        </div>
        <div className="workoutGrid">
          {plan.map((workout) => (
            <article className="workoutCard" key={workout.id}>
              <div className="workoutTitle">
                <span>{workout.day}</span>
                <b>Treino {workout.id}</b>
                <h2>{workout.title}</h2>
              </div>
              {workout.items.map((item, i) => (
                <div className="workoutItem" key={item.name}>
                  <i>{i + 1}</i>
                  <div>
                    <b>{item.name}</b>
                    <small>{item.detail}</small>
                  </div>
                </div>
              ))}
            </article>
          ))}
        </div>
        <div className="planNote">
          Faça 5–8 minutos de aquecimento. Interrompa o exercício se sentir dor
          aguda, tontura ou mal-estar.
        </div>
      </section>
    );
  else
    content = (
      <>
        <div className="summary">
          <div>
            <small>OBJETIVO</small>
            <b>{data.goal}</b>
            <span>
              <Target />
              Plano ativo
            </span>
          </div>
          <div>
            <small>ROTINA</small>
            <b>{data.days}x por semana</b>
            <span>
              <Dumbbell />
              {data.place}
            </span>
          </div>
          <div>
            <small>ALIMENTAÇÃO</small>
            <b>{calculateNutrition(data).calories} kcal</b>
            <span>
              <Salad />
              {data.diet}
            </span>
          </div>
        </div>
        <section className="today">
          <div className="todayHead">
            <div>
              <span>PRÓXIMO • TREINO {current.id}</span>
              <h2>{current.title}</h2>
            </div>
            <b>40–55 min</b>
          </div>
          {current.items.map((item, i) => (
            <div className="exercise" key={item.name}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </div>
              <div className="openDot" />
            </div>
          ))}
          <button className="primary" onClick={() => setTab("workouts")}>
            Ver plano completo <ArrowRight size={17} />
          </button>
        </section>
      </>
    );
  return (
    <div className="dash">
      <aside>
        <Logo />
        <div className="menu">
          <button
            className={tab === "overview" ? "current" : ""}
            onClick={() => setTab("overview")}
          >
            <Home />
            Visão geral
          </button>
          <button
            className={tab === "workouts" ? "current" : ""}
            onClick={() => setTab("workouts")}
          >
            <Dumbbell />
            Treinos
          </button>
          <button
            className={tab === "nutrition" ? "current" : ""}
            onClick={() => setTab("nutrition")}
          >
            <Salad />
            Alimentação
          </button>
          <button
            className={tab === "progress" ? "current" : ""}
            onClick={() => setTab("progress")}
          >
            <LineChart />
            Progresso
          </button>
          <button
            className={tab === "checkin" ? "current" : ""}
            onClick={() => setTab("checkin")}
          >
            <Check />
            Check-in
          </button>
          <button onClick={restart}>
            <UserRound />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={restart}>
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>{data.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header>
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>
              {tab === "checkin"
                ? "Check-in semanal"
                : tab === "progress"
                  ? "Seu progresso"
                  : tab === "nutrition"
                    ? "Sua alimentação"
                    : tab === "workouts"
                      ? "Seus treinos"
                      : `Vamos continuar, ${name}.`}
            </h1>
          </div>
          <button className="editProfile" onClick={restart}>
            Atualizar avaliação
          </button>
        </header>
        {content}
        <p className="disclaimer">
          Estimativas educativas. A EVOQUEST não substitui nutricionista, médico ou
          profissional de educação física.
        </p>
      </div>
    </div>
  );
}

function WorkoutExecutionV10({ workout, user, onClose, onSaved }) {
  const [logs, setLogs] = useState(() =>
      workout.items.map(() => ({ done: false, weight: "", reps: "" })),
    ),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [workoutSeconds, setWorkoutSeconds] = useState(0),
    [paused, setPaused] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [summary, setSummary] = useState(null);
  useEffect(() => {
    if (paused || summary) return;
    const timer = setInterval(
      () => setWorkoutSeconds((value) => value + 1),
      1000,
    );
    return () => clearInterval(timer);
  }, [paused, summary]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);
  const update = (i, key, value) =>
    setLogs(logs.map((l, index) => (index === i ? { ...l, [key]: value } : l)));
  const startTimer = (s = 60) => {
    setSeconds(s);
    setRunning(true);
  };
  async function finish() {
    const completed = logs.filter((l) => l.done).length;
    if (!completed)
      return setMessage("Marque ao menos um exercício concluído.");
    setSaving(true);
    const { data: session, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_code: workout.id,
        workout_title: workout.title,
        completed_exercises: completed,
        total_exercises: workout.items.length,
        duration_seconds: workoutSeconds,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return setMessage(
        "Não foi possível salvar. Confirme se a migração SQL foi executada.",
      );
    }
    const rows = workout.items.map((item, i) => ({
      session_id: session.id,
      user_id: user.id,
      exercise_name: item.name,
      completed: logs[i].done,
      weight_kg: logs[i].weight ? +logs[i].weight : null,
      repetitions: logs[i].reps ? +logs[i].reps : null,
    }));
    const result = await supabase.from("workout_exercise_logs").insert(rows);
    setSaving(false);
    if (result.error)
      return setMessage("A sessão foi criada, mas houve erro nos exercícios.");
    onSaved();
    onClose();
  }
  return (
    <section className="execution">
      <header>
        <div>
          <span>TREINO {workout.id} EM ANDAMENTO</span>
          <h2>{workout.title}</h2>
        </div>
        <button onClick={onClose}>Fechar</button>
      </header>
      <div className="executionProgress">
        <i
          style={{
            width: `${(logs.filter((l) => l.done).length / logs.length) * 100}%`,
          }}
        />
        <span>
          {logs.filter((l) => l.done).length} de {logs.length} exercícios
          concluídos
        </span>
      </div>
      {workout.items.map((item, i) => (
        <article className={logs[i].done ? "done" : ""} key={item.name}>
          <button
            className="checkExercise"
            onClick={() => update(i, "done", !logs[i].done)}
          >
            {logs[i].done ? <Check /> : i + 1}
          </button>
          <div className="exerciseInfo">
            <b>{item.name}</b>
            <small>{item.detail}</small>
          </div>
          <label>
            Carga (kg)
            <input
              type="number"
              min="0"
              step=".5"
              value={logs[i].weight}
              onChange={(e) => update(i, "weight", e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Repetições
            <input
              type="number"
              min="1"
              max="100"
              value={logs[i].reps}
              onChange={(e) => update(i, "reps", e.target.value)}
              placeholder="12"
            />
          </label>
          <button className="restButton" onClick={() => startTimer(60)}>
            Descanso
          </button>
        </article>
      ))}
      <div className="executionFooter">
        {seconds > 0 ? (
          <div className="timer">
            <b>
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </b>
            <span>Tempo de descanso</span>
            <button onClick={() => setSeconds(0)}>Pular</button>
          </div>
        ) : (
          <button className="timerStart" onClick={() => startTimer(60)}>
            Iniciar descanso de 60 s
          </button>
        )}
        <div>
          {message && <span>{message}</span>}
          <button className="primary" disabled={saving} onClick={finish}>
            {saving ? "Salvando..." : "Finalizar treino"}
          </button>
        </div>
      </div>
    </section>
  );
}

function WorkoutsPageV10({ plan, user }) {
  const [active, setActive] = useState(null),
    [history, setHistory] = useState([]);
  async function load() {
    const { data } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(10);
    setHistory(data || []);
  }
  useEffect(() => {
    load();
  }, []);
  if (active)
    return (
      <WorkoutExecution
        workout={active}
        user={user}
        onClose={() => setActive(null)}
        onSaved={load}
      />
    );
  return (
    <section className="workoutPlan">
      <div className="planIntro">
        <p>
          Escolha o treino do dia e registre cargas, repetições e conclusão.
        </p>
        <span>{history.length} sessões registradas</span>
      </div>
      <div className="workoutGrid">
        {plan.map((workout) => (
          <article className="workoutCard executable" key={workout.id}>
            <div className="workoutTitle">
              <span>{workout.day}</span>
              <b>Treino {workout.id}</b>
              <h2>{workout.title}</h2>
            </div>
            {workout.items.map((item, i) => (
              <div className="workoutItem" key={item.name}>
                <i>{i + 1}</i>
                <div>
                  <b>{item.name}</b>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
            <button className="primary" onClick={() => setActive(workout)}>
              Iniciar treino <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      <div className="sessionHistory">
        <div className="historyTitle">
          <h2>Treinos concluídos</h2>
          <span>{history.length} sessões</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((s) => (
            <article key={s.id}>
              <div>
                <b>
                  Treino {s.workout_code} — {s.workout_title}
                </b>
                <small>
                  {new Date(s.completed_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(s.completed_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <span>
                {s.completed_exercises}/{s.total_exercises} exercícios
              </span>
            </article>
          ))
        ) : (
          <p className="emptyHistory">
            Seu histórico aparecerá após o primeiro treino.
          </p>
        )}
      </div>
    </section>
  );
}

function DashboardV11({ data, user, restart, logout }) {
  const name = user?.user_metadata?.name || "Atleta";
  const [tab, setTab] = useState("overview");
  const plan = buildWeeklyPlan(data),
    current = plan[0];
  let content;
  if (tab === "checkin") content = <CheckinPage user={user} data={data} />;
  else if (tab === "progress")
    content = <ProgressPage user={user} data={data} />;
  else if (tab === "nutrition")
    content = <NutritionPlan data={data} user={user} />;
  else if (tab === "workouts")
    content = <WorkoutsPage plan={plan} user={user} />;
  else
    content = (
      <>
        <div className="summary">
          <div>
            <small>OBJETIVO</small>
            <b>{data.goal}</b>
            <span>
              <Target />
              Plano ativo
            </span>
          </div>
          <div>
            <small>ROTINA</small>
            <b>{data.days}x por semana</b>
            <span>
              <Dumbbell />
              {data.place}
            </span>
          </div>
          <div>
            <small>ALIMENTAÇÃO</small>
            <b>{calculateNutrition(data).calories} kcal</b>
            <span>
              <Salad />
              {data.diet}
            </span>
          </div>
        </div>
        <section className="today">
          <div className="todayHead">
            <div>
              <span>PRÓXIMO • TREINO {current.id}</span>
              <h2>{current.title}</h2>
            </div>
            <b>40–55 min</b>
          </div>
          {current.items.map((item, i) => (
            <div className="exercise" key={item.name}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </div>
              <div className="openDot" />
            </div>
          ))}
          <button className="primary" onClick={() => setTab("workouts")}>
            Iniciar um treino <ArrowRight size={17} />
          </button>
        </section>
      </>
    );
  return (
    <div className="dash">
      <aside>
        <Logo />
        <div className="menu">
          <button
            className={tab === "overview" ? "current" : ""}
            onClick={() => setTab("overview")}
          >
            <Home />
            Visão geral
          </button>
          <button
            className={tab === "workouts" ? "current" : ""}
            onClick={() => setTab("workouts")}
          >
            <Dumbbell />
            Treinos
          </button>
          <button
            className={tab === "nutrition" ? "current" : ""}
            onClick={() => setTab("nutrition")}
          >
            <Salad />
            Alimentação
          </button>
          <button
            className={tab === "progress" ? "current" : ""}
            onClick={() => setTab("progress")}
          >
            <LineChart />
            Progresso
          </button>
          <button
            className={tab === "checkin" ? "current" : ""}
            onClick={() => setTab("checkin")}
          >
            <Check />
            Check-in
          </button>
          <button onClick={restart}>
            <UserRound />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={restart}>
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>{data.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header>
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>
              {tab === "checkin"
                ? "Check-in semanal"
                : tab === "progress"
                  ? "Seu progresso"
                  : tab === "nutrition"
                    ? "Sua alimentação"
                    : tab === "workouts"
                      ? "Seus treinos"
                      : `Vamos continuar, ${name}.`}
            </h1>
          </div>
          <button className="editProfile" onClick={restart}>
            Atualizar avaliação
          </button>
        </header>
        {content}
        <p className="disclaimer">
          Estimativas educativas. A EVOQUEST não substitui profissionais de saúde.
        </p>
      </div>
    </div>
  );
}

function progressionFor(last) {
  if (!last || !last.completed) return "Comece com uma carga confortável";
  if (!last.weight_kg)
    return `Repita ${last.repetitions || "as"} repetições com boa técnica`;
  const next = Math.round(Number(last.weight_kg) * 1.025);
  return `Se a técnica estiver boa, tente até ${next} kg`;
}
function exerciseGuide(name) {
  const n = name.toLowerCase();
  if (
    n.includes("agachamento") ||
    n.includes("leg press") ||
    n.includes("afundo")
  )
    return {
      muscles: "Quadríceps, glúteos e core",
      steps: [
        "Pés firmes e abdômen ativo.",
        "Desça com os joelhos na direção dos pés.",
        "Suba empurrando o chão.",
      ],
      mistake: "Evite arredondar as costas ou fechar os joelhos.",
      swap: "Sentar e levantar de um banco.",
    };
  if (n.includes("supino") || n.includes("flexão"))
    return {
      muscles: "Peitoral, tríceps e ombros",
      steps: [
        "Aproxime as escápulas.",
        "Desça com controle.",
        "Empurre sem projetar os ombros.",
      ],
      mistake: "Evite abrir demais os cotovelos.",
      swap: "Flexão inclinada com apoio.",
    };
  if (n.includes("remada") || n.includes("puxada") || n.includes("face pull"))
    return {
      muscles: "Costas, bíceps e ombros posteriores",
      steps: [
        "Mantenha a coluna neutra.",
        "Inicie pelas escápulas.",
        "Puxe sem impulso e retorne devagar.",
      ],
      mistake: "Evite balançar o tronco.",
      swap: "Remada com elástico ou mochila.",
    };
  if (n.includes("terra") || n.includes("romeno"))
    return {
      muscles: "Posterior de coxa, glúteos e core",
      steps: [
        "Carga próxima ao corpo.",
        "Leve o quadril para trás.",
        "Suba contraindo os glúteos.",
      ],
      mistake: "Evite arredondar a coluna.",
      swap: "Ponte de glúteos no chão.",
    };
  if (n.includes("desenvolvimento") || n.includes("elevação lateral"))
    return {
      muscles: "Ombros e tríceps",
      steps: [
        "Abdômen firme.",
        "Eleve sem encolher os ombros.",
        "Desça lentamente.",
      ],
      mistake: "Evite impulso e excesso de carga.",
      swap: "Use elástico ou garrafas leves.",
    };
  if (n.includes("rosca"))
    return {
      muscles: "Bíceps e antebraços",
      steps: [
        "Cotovelos próximos ao corpo.",
        "Flexione sem mover os ombros.",
        "Desça controlando.",
      ],
      mistake: "Evite balançar o tronco.",
      swap: "Rosca com elástico ou mochila.",
    };
  if (n.includes("tríceps"))
    return {
      muscles: "Tríceps",
      steps: ["Fixe os cotovelos.", "Estenda os braços.", "Retorne devagar."],
      mistake: "Evite abrir os cotovelos.",
      swap: "Extensão com elástico.",
    };
  return {
    muscles: "Glúteos, core e estabilizadores",
    steps: [
      "Mantenha o abdômen ativo.",
      "Use amplitude confortável.",
      "Respire e controle o movimento.",
    ],
    mistake: "Evite prender a respiração ou insistir com dor.",
    swap: "Reduza a amplitude ou use uma versão apoiada.",
  };
}
const demoVideos = [
  {
    terms: ["agachamento livre", "agachamento no banco", "agachamento"],
    src: "https://videos.pexels.com/video-files/5034577/5034577-uhd_3840_2160_30fps.mp4",
    page: "https://www.pexels.com/video/woman-doing-squat-exercise-5034577/",
    credit: "Ketut Subiyanto",
  },
  {
    terms: ["rosca direta", "rosca com halteres", "bíceps"],
    src: "https://videos.pexels.com/video-files/5319094/5319094-uhd_2160_3840_25fps.mp4",
    page: "https://www.pexels.com/video/a-man-working-out-using-dumbbell-5319094/",
    credit: "Tima Miroshnichenko",
  },
  {
    terms: ["supino com halteres", "supino inclinado", "dumbbell press"],
    src: "https://videos.pexels.com/video-files/38412018/16310754_3840_2160_25fps.mp4",
    page: "https://www.pexels.com/video/intense-dumbbell-workout-in-home-gym-38412018/",
    credit: "JULLIAN PRODUCTION",
  },
];
function videoFor(name) {
  const n = normalize(name);
  return demoVideos.find((v) => v.terms.some((t) => n.includes(normalize(t))));
}
function ExerciseVideo({ name }) {
  const video = videoFor(name);
  if (!video)
    return (
      <div className="videoUnavailable">
        <span>▶</span>
        <b>Vídeo ainda não disponível</b>
        <small>
          Use as instruções abaixo. Não mostraremos um vídeo de outro exercício.
        </small>
      </div>
    );
  return (
    <div className="realExerciseVideo">
      <video controls muted loop playsInline preload="metadata">
        <source src={video.src} type="video/mp4" />
        Seu navegador não suporta vídeo.
      </video>
      <div>
        <span>VÍDEO DE TESTE</span>
        <a href={video.page} target="_blank" rel="noreferrer">
          Vídeo: {video.credit} / Pexels
        </a>
      </div>
    </div>
  );
}
function ExerciseGuide({ name }) {
  return <ExerciseGuidePhotos name={name} />;
}

function WorkoutExecution({ workout, user, onClose, onSaved, lastByExercise }) {
  const [logs, setLogs] = useState(() =>
      workout.items.map((item) => {
        const count = parseSetCount(item.detail);
        const last = lastByExercise[item.name];
        return {
          done: false,
          sets: Array.from({ length: count }, () => ({
            done: false,
            weight: last?.weight_kg || item.weight || "",
            reps: last?.repetitions || "",
          })),
        };
      }),
    ),
    [activeIndex, setActiveIndex] = useState(0),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [workoutSeconds, setWorkoutSeconds] = useState(0),
    [paused, setPaused] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [combo, setCombo] = useState(0),
    [maxCombo, setMaxCombo] = useState(0),
    [setFlash, setSetFlash] = useState(false),
    [workoutCelebrating, setWorkoutCelebrating] = useState(false),
    [summary, setSummary] = useState(null);
  useEffect(() => {
    if (paused || summary) return;
    const timer = setInterval(
      () => setWorkoutSeconds((value) => value + 1),
      1000,
    );
    return () => clearInterval(timer);
  }, [paused, summary]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);
  const updateSet = (exerciseIndex, setIndex, key, value) =>
    setLogs(
      logs.map((log, index) =>
        index === exerciseIndex
          ? {
              ...log,
              sets: log.sets.map((set, current) =>
                current === setIndex ? { ...set, [key]: value } : set,
              ),
            }
          : log,
      ),
    );
  function completeSet(exerciseIndex, setIndex) {
    const wasDone = logs[exerciseIndex].sets[setIndex].done;
    const next = logs.map((log, index) => {
      if (index !== exerciseIndex) return log;
      const sets = log.sets.map((set, current) =>
        current === setIndex ? { ...set, done: !set.done } : set,
      );
      return { ...log, sets, done: sets.every((set) => set.done) };
    });
    setLogs(next);
    if (!wasDone) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((current) => Math.max(current, nextCombo));
      setSetFlash(true);
      window.setTimeout(() => setSetFlash(false), 550);
      startTimer(60);
    } else {
      setCombo(0);
    }
  }
  const startTimer = (s) => {
    setSeconds(s);
    setRunning(true);
  };
  async function finish() {
    const completed = logs.filter((l) => l.done).length;
    if (!completed)
      return setMessage("Marque ao menos um exercício concluído.");
    setSaving(true);
    const { data: session, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_code: workout.id,
        workout_title: workout.title,
        completed_exercises: completed,
        total_exercises: workout.items.length,
        duration_seconds: workoutSeconds,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return setMessage("Não foi possível salvar o treino.");
    }
    const rows = workout.items.flatMap((item, i) =>
      logs[i].sets.map((set, setIndex) => ({
        session_id: session.id,
        user_id: user.id,
        exercise_name: item.name,
        set_number: setIndex + 1,
        completed: set.done,
        weight_kg: set.weight ? +set.weight : null,
        repetitions: set.reps ? +set.reps : null,
      })),
    );
    const result = await supabase.from("workout_exercise_logs").insert(rows);
    setSaving(false);
    if (result.error) return setMessage("Houve erro ao salvar os exercícios.");
    await onSaved();
    setSummary({
      completed,
      total: workout.items.length,
      duration: workoutSeconds,
      sets: rows.filter((row) => row.completed).length,
      volume: rows
        .filter((row) => row.completed)
        .reduce(
          (total, row) =>
            total + (Number(row.weight_kg) || 0) * (Number(row.repetitions) || 0),
          0,
        ),
      maxCombo,
    });
    setWorkoutCelebrating(true);
    window.setTimeout(() => setWorkoutCelebrating(false), 3200);
  }
  const completedSets = logs.reduce(
    (total, log) => total + log.sets.filter((set) => set.done).length,
    0,
  );
  const totalSets = logs.reduce((total, log) => total + log.sets.length, 0);
  const missionPercent = totalSets
    ? Math.round((completedSets / totalSets) * 100)
    : 0;
  const liveXp = completedSets * 10 + maxCombo * 2;
  if (summary)
    return (
      <section className="workoutSummary">
        {workoutCelebrating && <GoalCelebration type="workout" />}
        <span>MISSÃO CONCLUÍDA</span>
        <h2>Treino finalizado!</h2>
        <div>
          <article>
            <small>EXERCÍCIOS</small>
            <b>
              {summary.completed}/{summary.total}
            </b>
          </article>
          <article>
            <small>SÉRIES</small>
            <b>{summary.sets}</b>
          </article>
          <article>
            <small>TEMPO</small>
            <b>{Math.floor(summary.duration / 60)} min</b>
          </article>
          <article>
            <small>XP</small>
            <b>+{summary.sets * 10 + summary.maxCombo * 2}</b>
          </article>
          <article>
            <small>VOLUME</small>
            <b>{Math.round(summary.volume).toLocaleString("pt-BR")} kg</b>
          </article>
          <article>
            <small>COMBO MÁX.</small>
            <b>×{summary.maxCombo}</b>
          </article>
        </div>
        <button className="primary" onClick={onClose}>
          Voltar aos treinos
        </button>
      </section>
    );
  return (
    <section className={`execution missionMode ${setFlash ? "setFlash" : ""}`}>
      <div className="missionHud">
        <div className="missionHudTitle">
          <span>MISSÃO ATIVA</span>
          <b>Complete todas as séries</b>
        </div>
        <div className="missionStats">
          <p>
            <small>PROGRESSO</small>
            <b>{missionPercent}%</b>
          </p>
          <p className={combo >= 3 ? "hotCombo" : ""}>
            <small>COMBO</small>
            <b>×{combo}</b>
          </p>
          <p>
            <small>XP</small>
            <b>+{liveXp}</b>
          </p>
        </div>
        <div className="missionBar" aria-label={`${missionPercent}% concluído`}>
          <i style={{ width: `${missionPercent}%` }} />
        </div>
        <small className="missionSetCount">
          {completedSets}/{totalSets} séries concluídas
        </small>
      </div>
      <header>
        <div>
          <span>TREINO {workout.id} EM ANDAMENTO</span>
          <h2>{workout.title}</h2>
        </div>
        <div className="executionHeaderActions">
          <b>
            {String(Math.floor(workoutSeconds / 60)).padStart(2, "0")}:
            {String(workoutSeconds % 60).padStart(2, "0")}
          </b>
          <button onClick={() => setPaused((value) => !value)}>
            {paused ? <Play /> : <Pause />}
            {paused ? "Retomar" : "Pausar"}
          </button>
          <button
            onClick={() =>
              window.confirm("Encerrar sem salvar este treino?") && onClose()
            }
          >
            Sair
          </button>
        </div>
      </header>
      <div className="executionProgress">
        <i
          style={{
            width: `${(logs.filter((l) => l.done).length / logs.length) * 100}%`,
          }}
        />
        <span>
          {logs.filter((l) => l.done).length} de {logs.length} exercícios
          concluídos
        </span>
      </div>
      <nav className="exerciseStepper">
        {workout.items.map((item, index) => (
          <button
            className={`${activeIndex === index ? "active" : ""} ${logs[index].done ? "complete" : ""}`}
            onClick={() => setActiveIndex(index)}
            key={`${item.name}-${index}`}
          >
            {logs[index].done ? <Check /> : index + 1}
          </button>
        ))}
      </nav>
      {workout.items.map((item, i) => {
        const last = lastByExercise[item.name];
        if (i !== activeIndex) return null;
        return (
          <article className={logs[i].done ? "done" : ""} key={item.name}>
            <div className="exerciseInfo">
              <b>{item.name}</b>
              <small>{item.detail}</small>
              <em>
                {last
                  ? `Último: ${last.weight_kg || "—"} kg × ${last.repetitions || "—"} reps`
                  : "Primeiro registro"}{" "}
                • {progressionFor(last)}
              </em>
              <div className="exerciseMissionStatus">
                <span>ALVO ATUAL</span>
                <b>
                  Série {Math.min(logs[i].sets.filter((set) => set.done).length + 1, logs[i].sets.length)} de {logs[i].sets.length}
                </b>
              </div>
              <ExerciseGuide name={item.name} />
            </div>
            <div className="setTracker">
              <header>
                <span>SÉRIE</span>
                <span>CARGA</span>
                <span>REPS</span>
                <span>FEITO</span>
              </header>
              {logs[i].sets.map((set, setIndex) => (
                <div className={set.done ? "setDone" : ""} key={setIndex}>
                  <b>{setIndex + 1}</b>
                  <input
                    type="number"
                    min="0"
                    step=".5"
                    value={set.weight}
                    onChange={(event) =>
                      updateSet(i, setIndex, "weight", event.target.value)
                    }
                    placeholder="kg"
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={set.reps}
                    onChange={(event) =>
                      updateSet(i, setIndex, "reps", event.target.value)
                    }
                    placeholder="reps"
                  />
                  <button onClick={() => completeSet(i, setIndex)}>
                    {set.done ? <Check /> : "OK"}
                  </button>
                </div>
              ))}
            </div>
          </article>
        );
      })}
      <div className="executionNavigation">
        <button
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((index) => index - 1)}
        >
          Anterior
        </button>
        <button
          disabled={activeIndex === workout.items.length - 1}
          onClick={() => setActiveIndex((index) => index + 1)}
        >
          Próximo exercício <ArrowRight />
        </button>
      </div>
      <div className="executionFooter">
        {seconds > 0 ? (
          <div className={`timer restMission ${seconds <= 10 ? "ending" : ""}`}>
            <small>RECUPERE SUA ENERGIA</small>
            <b>
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </b>
            <span>Tempo de descanso</span>
            <button onClick={() => setSeconds(0)}>Pular</button>
          </div>
        ) : (
          <div className="timerChoices">
            <button onClick={() => startTimer(45)}>45 s</button>
            <button onClick={() => startTimer(60)}>60 s</button>
            <button onClick={() => startTimer(90)}>90 s</button>
          </div>
        )}
        <div>
          {message && <span>{message}</span>}
          <button className="primary" disabled={saving} onClick={finish}>
            {saving ? "Salvando..." : "Finalizar treino"}
          </button>
        </div>
      </div>
    </section>
  );
}

function WorkoutsPageV14({ plan, user }) {
  const [active, setActive] = useState(null),
    [history, setHistory] = useState([]),
    [logs, setLogs] = useState([]),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const [sessionsResult, logsResult] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase
        .from("workout_exercise_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setHistory(sessionsResult.data || []);
    setLogs(logsResult.data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const lastByExercise = {};
  logs.forEach((l) => {
    if (!lastByExercise[l.exercise_name]) lastByExercise[l.exercise_name] = l;
  });
  const now = Date.now(),
    week = history.filter(
      (s) => now - new Date(s.completed_at).getTime() < 7 * 86400000,
    );
  const completion = history.length
    ? Math.round(
        (history.reduce(
          (sum, s) => sum + s.completed_exercises / s.total_exercises,
          0,
        ) /
          history.length) *
          100,
      )
    : 0;
  const trainingDays = new Set(
    history.map((s) => new Date(s.completed_at).toDateString()),
  ).size;
  const improved = Object.values(
    logs.reduce((acc, l) => {
      if (!l.weight_kg) return acc;
      (acc[l.exercise_name] ??= []).push(Number(l.weight_kg));
      return acc;
    }, {}),
  ).filter((v) => v.length > 1 && v[0] > v.at(-1)).length;
  if (active)
    return (
      <WorkoutExecution
        workout={active}
        user={user}
        onClose={() => setActive(null)}
        onSaved={load}
        lastByExercise={lastByExercise}
      />
    );
  return (
    <section className="workoutPlan">
      <div className="performanceStats">
        <article>
          <small>ESTA SEMANA</small>
          <b>{week.length}</b>
          <span>treinos concluídos</span>
        </article>
        <article>
          <small>CONCLUSÃO MÉDIA</small>
          <b>{completion}%</b>
          <span>dos exercícios</span>
        </article>
        <article>
          <small>DIAS ATIVOS</small>
          <b>{trainingDays}</b>
          <span>no histórico</span>
        </article>
        <article>
          <small>EVOLUÇÕES</small>
          <b>{improved}</b>
          <span>exercícios com carga maior</span>
        </article>
      </div>
      <div className="planIntro">
        <p>
          A EVOQUEST preenche a última carga e sugere uma progressão leve quando
          houver histórico.
        </p>
        <span>{loading ? "Carregando..." : `${history.length} sessões`}</span>
      </div>
      <div className="workoutGrid">
        {plan.map((workout) => (
          <article className="workoutCard executable" key={workout.id}>
            <div className="workoutTitle">
              <span>{workout.day}</span>
              <b>Treino {workout.id}</b>
              <h2>{workout.title}</h2>
            </div>
            {workout.items.map((item, i) => {
              const last = lastByExercise[item.name];
              return (
                <div className="workoutItem performance" key={item.name}>
                  <i>{i + 1}</i>
                  <div>
                    <b>{item.name}</b>
                    <small>
                      {last
                        ? `Último: ${last.weight_kg || "—"} kg × ${last.repetitions || "—"} reps`
                        : "Sem histórico"}
                    </small>
                  </div>
                </div>
              );
            })}
            <button className="primary" onClick={() => setActive(workout)}>
              Iniciar treino <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      <div className="sessionHistory">
        <div className="historyTitle">
          <h2>Desempenho recente</h2>
          <span>{history.length} sessões</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((s) => (
            <article key={s.id}>
              <div>
                <b>
                  Treino {s.workout_code} — {s.workout_title}
                </b>
                <small>
                  {new Date(s.completed_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(s.completed_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <span>
                {Math.round((s.completed_exercises / s.total_exercises) * 100)}%
                concluído
              </span>
            </article>
          ))
        ) : (
          <p className="emptyHistory">
            Seu histórico aparecerá após o primeiro treino.
          </p>
        )}
      </div>
    </section>
  );
}

function weekDates() {
  const monday = startOfCurrentWeek();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function OverviewPage({ data, user, plan, go }) {
  const [sessions, setSessions] = useState([]),
    [foods, setFoods] = useState([]),
    [water, setWater] = useState([]),
    [progress, setProgress] = useState([]),
    [changes, setChanges] = useState([]),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(30),
      supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("consumed_on", new Date().toISOString().slice(0, 10)),
      supabase
        .from("hydration_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .eq("consumed_on", new Date().toISOString().slice(0, 10)),
      supabase
        .from("progress_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(2),
      supabase
        .from("trainer_change_log")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]).then(([s, f, w, p, ch]) => {
      if (!active) return;
      const firstError = [s, f, p, ch].find((result) => result.error)?.error;
      setLoadError(
        firstError
          ? "Alguns dados não foram sincronizados. Atualize a página ou tente novamente."
          : "",
      );
      setSessions(s.data || []);
      setFoods(f.data || []);
      setWater(w.data || []);
      setProgress(p.data || []);
      setChanges(ch.data || []);
    });
    return () => {
      active = false;
    };
  }, [user.id]);
  const dates = weekDates(),
    weekStart = dates[0],
    weekSessions = sessionsInCurrentWeek(sessions),
    doneCodes = weekSessions.map((s) => s.workout_code),
    current = selectCurrentWorkout(plan, sessions),
    percent = Math.min(
      100,
      Math.round((weekSessions.length / (Number(data.days) || 3)) * 100),
    ),
    todayDone = sessions.some(
      (s) =>
        new Date(s.completed_at).toDateString() === new Date().toDateString(),
    ),
    target = calculateNutrition(data).calories,
    { consumed, remaining } = caloriesRemaining(target, foods),
    waterTarget = calculateHydration(data),
    waterConsumed = water.reduce((sum, entry) => sum + Number(entry.amount_ml), 0),
    latest = progress[0],
    previous = progress[1],
    bodyChange =
      latest && previous
        ? {
            label: "Peso",
            value: +latest.weight_kg - +previous.weight_kg,
            unit: "kg",
          }
        : null,
    recentChange = changes.find(
      (x) => Date.now() - new Date(x.created_at).getTime() < 7 * 86400000,
    ),
    alerts = [];
  if (recentChange)
    alerts.push(
      recentChange.change_type === "workout"
        ? "Seu personal atualizou sua prancheta de treino."
        : "Seu personal atualizou sua avaliação física.",
    );
  if (data.restrictions)
    alerts.push(`Atenção à limitação registrada: ${data.restrictions}`);
  return (
    <section className="cleanHome">
      {loadError && (
        <div className="syncWarning">
          <AlertTriangle />
          {loadError}
        </div>
      )}
      {current ? (
        <article className="homeWorkoutHero">
          <div>
            <div className="homeHello">MISSÃO DO DIA</div>
            <span>
              {todayDone ? "PRÓXIMA MISSÃO" : "FASE ATUAL"} •{" "}
              {current.day || `TREINO ${current.id}`}
            </span>
            <h2>{current.title}</h2>
            <p>
              <b>{current.items.length} exercícios</b>
              <i />
              aproximadamente 45 minutos
            </p>
            <button className="primary" onClick={() => go("workouts")}>
              {todayDone ? "Escolher próximo treino" : "Iniciar treino"}{" "}
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="homeMissionStage" aria-hidden="true">
            <SpriteActor character="a" action={todayDone ? "victory" : "strength"} />
            <div>
              <span>{todayDone ? "STAGE CLEAR" : "PLAYER READY"}</span>
              <b>{todayDone ? "+100 XP" : "START"}</b>
            </div>
            <SpriteActor character="b" action={todayDone ? "victory" : "strength"} />
          </div>
        </article>
      ) : (
        <article className="homeWorkoutHero">
          <div>
            <span>PRANCHETA</span>
            <h2>Nenhum treino disponível</h2>
            <button className="primary" onClick={() => go("workouts")}>
              Montar meus treinos
            </button>
          </div>
          <div className="homeMissionStage" aria-hidden="true">
            <SpriteActor character="a" action="idle" />
            <div><span>CREATE STAGE</span><b>START</b></div>
            <SpriteActor character="b" action="idle" />
          </div>
        </article>
      )}
      <div className="homeTodayStrip">
        <div className="todayTraining">
          <span className="todayIcon" aria-hidden="true">
            <Dumbbell />
          </span>
          <span className="todayCopy">
            <small>STATUS DA MISSÃO</small>
            <b className={todayDone ? "doneText" : ""}>
              {todayDone ? "Concluído" : "Pendente"}
            </b>
          </span>
        </div>
        <div className="todayCalories">
          <span className="todayIcon" aria-hidden="true">
            <Flame />
          </span>
          <span className="todayCopy">
            <small>ENERGIA RESTANTE</small>
            <b>{remaining.toLocaleString("pt-BR")} kcal</b>
          </span>
        </div>
        <button className="todayWater" onClick={() => go("nutrition")}>
          <span className="todayIcon" aria-hidden="true">
            <Droplets />
          </span>
          <span className="todayCopy">
            <small>ÁGUA DO DIA</small>
            <b>
              {waterConsumed.toLocaleString("pt-BR")}/
              {waterTarget.toLocaleString("pt-BR")} ml
            </b>
          </span>
        </button>
      </div>
      <article className="homeWeekProgress">
        <header>
          <div>
            <span>PROGRESSO DA SEMANA</span>
            <h2>
              {weekSessions.length >= Number(data.days)
                ? "FASE CONCLUÍDA!"
                : `${weekSessions.length} de ${data.days} treinos concluídos`}
            </h2>
          </div>
          <b>{percent}%</b>
        </header>
        <i>
          <em style={{ width: `${percent}%` }} />
        </i>
        <footer>
          <span>
            {weekSessions.length >= Number(data.days)
              ? "Mandou bem! Sua meta da semana está completa."
              : `${Math.max(0, Number(data.days) - weekSessions.length)} treino(s) para concluir sua meta.`}
          </span>
          {bodyChange && (
            <b>
              {bodyChange.label}: {bodyChange.value > 0 ? "+" : ""}
              {bodyChange.value.toFixed(1)} {bodyChange.unit}
            </b>
          )}
        </footer>
      </article>
      <button className="seasonPreview" onClick={() => go("ranking")}>
        <span>
          <Trophy />
        </span>
        <div>
          <small>TEMPORADA MENSAL</small>
          <b>Missões, XP e ranking do seu objetivo</b>
        </div>
        <ArrowRight />
      </button>
      {alerts.length > 0 && (
        <div className="homeAlerts">
          <span>PRECISA DA SUA ATENÇÃO</span>
          {alerts.slice(0, 3).map((x, i) => (
            <button
              key={x}
              onClick={() =>
                go(
                  i === 0 && recentChange?.change_type === "workout"
                    ? "workouts"
                    : "progress",
                )
              }
            >
              <AlertTriangle />
              <b>{x}</b>
              <ArrowRight />
            </button>
          ))}
        </div>
      )}
      <div className="quickActions">
        <span>ATALHOS DE JOGO</span>
        <div>
          <button onClick={() => go("workouts")}>
            <Dumbbell />
            <b>Abrir meu treino</b>
            <small>Prancheta atual</small>
          </button>
          <button onClick={() => go("nutrition")}>
            <Salad />
            <b>Registrar alimento</b>
            <small>Atualizar calorias</small>
          </button>
          <button onClick={() => go("progress")}>
            <LineChart />
            <b>Registrar peso</b>
            <small>Nova avaliação</small>
          </button>
        </div>
      </div>
    </section>
  );
}

function StudentProfile({ user, profile, saved }) {
  const [name, setName] = useState(profile?.full_name || ""),
    [preview, setPreview] = useState(profile?.avatar_url || ""),
    [file, setFile] = useState(null),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [showDeleteFlow, setShowDeleteFlow] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(""),
    [deleting, setDeleting] = useState(false),
    [deleteMessage, setDeleteMessage] = useState("");
  function choosePhoto(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (
      !selected.type.startsWith("image/") ||
      selected.size > 3 * 1024 * 1024
    ) {
      setMessage("Use uma imagem JPG, PNG ou WebP de até 3 MB.");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setMessage("");
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    let avatarUrl = profile?.avatar_url || "";
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/profile.${extension}`;
      const upload = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upload.error) {
        setSaving(false);
        setMessage(
          "Não foi possível enviar a foto. Execute a atualização SQL 014.",
        );
        return;
      }
      avatarUrl = `${supabase.storage.from("profile-photos").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    }
    const result = await supabase
      .from("app_profiles")
      .update({
        full_name: name.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (!result.error)
      await supabase.auth.updateUser({ data: { name: name.trim() } });
    setSaving(false);
    if (result.error) setMessage("Não foi possível salvar o perfil.");
    else {
      setMessage("Perfil atualizado!");
      saved();
    }
  }
  async function deleteAccount() {
    if (deleteConfirm !== "EXCLUIR" || deleting) return;
    setDeleting(true);
    setDeleteMessage("");
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: deleteConfirm },
    });
    if (error) {
      setDeleting(false);
      setDeleteMessage("Não foi possível excluir. Confirme se a função delete-account foi publicada no Supabase.");
      return;
    }
    await supabase.auth.signOut();
    window.location.reload();
  }
  return (
    <div className="studentProfilePage">
      <form className="studentProfileEditor" onSubmit={save}>
        <span>PERFIL DO JOGADOR</span>
        <h2>Personalize sua conta</h2>
        <div className="profilePhotoEditor">
          <label className="photoPreview">
            {preview ? <img src={preview} alt="Foto de perfil" /> : <UserRound />}
            <i><Camera /></i>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
          </label>
          <div>
            <b>Foto de perfil</b>
            <small>JPG, PNG ou WebP • máximo de 3 MB</small>
          </div>
        </div>
        <label className="profileNameField">
          Nome exibido
          <input required maxLength="80" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {message && <div className="profileSaveMessage">{message}</div>}
        <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</button>
      </form>
      <section className="deleteAccountZone">
        <span>ZONA DE PERIGO</span>
        {!showDeleteFlow ? (
          <button type="button" className="deleteAccountOpenButton" onClick={() => setShowDeleteFlow(true)}>
            Excluir conta
          </button>
        ) : (
          <div className="deleteAccountConfirm">
            <p>Esta ação é permanente e excluirá sua conta e todos os seus dados.</p>
            <label>
              Para confirmar, digite <b>EXCLUIR</b>
              <input autoFocus value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value.toUpperCase())} placeholder="EXCLUIR" />
            </label>
            {deleteMessage && <div className="deleteAccountMessage">{deleteMessage}</div>}
            <div className="deleteAccountActions">
              <button type="button" className="deleteAccountButton" disabled={deleteConfirm !== "EXCLUIR" || deleting} onClick={deleteAccount}>
                <Trash2 /> {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button type="button" className="deleteAccountCancelButton" disabled={deleting} onClick={() => {
                setShowDeleteFlow(false);
                setDeleteConfirm("");
                setDeleteMessage("");
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function GameProgress({ user, data, go }) {
  const [state, setState] = useState({
      loading: true,
      error: "",
      ranking: [],
      sessions: [],
      foodCount: 0,
      waterTotal: 0,
      latestProgress: null,
      goals: null,
    }),
    today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    let active = true;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.rpc("movra_monthly_ranking"),
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", monthStart.toISOString())
        .order("completed_at", { ascending: false }),
      supabase
        .from("food_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("consumed_on", today),
      supabase
        .from("hydration_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .eq("consumed_on", today),
      supabase
        .from("progress_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([ranking, sessions, foods, hydration, progress, goalsResult]) => {
      if (!active) return;
      setState({
        loading: false,
        error: ranking.error
          ? "Execute a migração 019 para ativar o ranking mensal."
          : "",
        ranking: ranking.data || [],
        sessions: sessions.data || [],
        foodCount: foods.count || 0,
        waterTotal: (hydration.data || []).reduce(
          (sum, entry) => sum + Number(entry.amount_ml),
          0,
        ),
        latestProgress: progress.data || null,
        goals: goalsResult.data || null,
      });
    });
    return () => {
      active = false;
    };
  }, [user.id]);
  const weekSessions = sessionsInCurrentWeek(state.sessions),
    todayDone = state.sessions.some(
      (session) =>
        new Date(session.completed_at).toDateString() ===
        new Date().toDateString(),
    ),
    me = state.ranking.find((entry) => entry.is_me),
    points = Number(me?.points || 0),
    level = Math.floor(points / 500) + 1,
    nextLevel = level * 500,
    levelProgress = Math.min(100, ((points % 500) / 500) * 100),
    weeklyTarget = Number(data.days) || 3,
    dailyMissions = [
      {
        label: "Concluir o treino do dia",
        done: todayDone,
        xp: 100,
        action: "workouts",
      },
      {
        label: "Registrar sua alimentação",
        done: state.foodCount > 0,
        xp: 30,
        action: "nutrition",
      },
      {
        label: "Completar a meta de água",
        done: state.waterTotal >= calculateHydration(data),
        xp: 60,
        action: "nutrition",
      },
      {
        label: "Revisar o progresso corporal",
        done: state.latestProgress?.recorded_at === today,
        xp: 40,
        action: "progress",
      },
    ],
    finalGoal = state.goals?.target_weight_kg
      ? `${state.goals.target_weight_kg} kg`
      : data.goal || "Definir objetivo";
  if (state.loading)
    return <div className="gameLoading">CARREGANDO TEMPORADA...</div>;
  return (
    <section className="gameHub">
      <div className="seasonHero">
        <div>
          <span>TEMPORADA MENSAL • {data.goal || "OBJETIVO FITNESS"}</span>
          <h2>Nível {level}</h2>
          <p>{points} XP conquistados neste mês</p>
        </div>
        <div className="levelMeter">
          <b>{Math.max(0, nextLevel - points)} XP para o próximo nível</b>
          <i>
            <em style={{ width: `${levelProgress}%` }} />
          </i>
        </div>
      </div>
      <div className="gameMissionGrid">
        <section>
          <header>
            <span>MISSÕES DIÁRIAS</span>
            <b>
              {dailyMissions.filter((mission) => mission.done).length}/
              {dailyMissions.length}
            </b>
          </header>
          {dailyMissions.map((mission) => (
            <button
              className={mission.done ? "missionDone" : ""}
              onClick={() => go(mission.action)}
              key={mission.label}
            >
              <i>{mission.done ? <Check /> : <Target />}</i>
              <span>
                <b>{mission.label}</b>
                <small>+{mission.xp} XP</small>
              </span>
              <ArrowRight />
            </button>
          ))}
        </section>
        <section className="weeklyQuest">
          <header>
            <span>MISSÃO SEMANAL</span>
            <b>
              {weekSessions.length}/{weeklyTarget}
            </b>
          </header>
          <Trophy />
          <h3>Complete sua frequência</h3>
          <p>
            {Math.max(0, weeklyTarget - weekSessions.length)} treino(s) restante(s)
            nesta semana.
          </p>
          <i>
            <em
              style={{
                width: `${Math.min(100, (weekSessions.length / weeklyTarget) * 100)}%`,
              }}
            />
          </i>
          <small>RECOMPENSA: +300 XP</small>
        </section>
        <section className="finalQuest">
          <header>
            <span>OBJETIVO FINAL</span>
          </header>
          <Target />
          <h3>{finalGoal}</h3>
          <p>
            {state.goals?.target_date
              ? `Prazo: ${new Date(`${state.goals.target_date}T12:00`).toLocaleDateString("pt-BR")}`
              : "Defina seu peso-alvo e prazo na aba Progresso."}
          </p>
          <button onClick={() => go("progress")}>Atualizar objetivo</button>
        </section>
      </div>
      <section className="rankingBoard">
        <header>
          <div>
            <span>RANKING MENSAL</span>
            <h2>Jogadores com o mesmo objetivo</h2>
          </div>
          {me && <b>SUA POSIÇÃO: #{me.rank}</b>}
        </header>
        {state.error && <div className="rankingError">{state.error}</div>}
        {!state.error && state.ranking.length === 0 && (
          <p>A temporada começa quando houver atividades registradas.</p>
        )}
        <div>
          {state.ranking.slice(0, 20).map((entry) => (
            <article className={entry.is_me ? "isPlayer" : ""} key={entry.rank}>
              <strong>#{entry.rank}</strong>
              <span className="rankAvatar">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" />
                ) : (
                  entry.display_name?.slice(0, 2).toUpperCase()
                )}
              </span>
              <span>
                <b>{entry.display_name}</b>
                <small>
                  {entry.workouts} treinos • {entry.active_days} dias ativos
                </small>
              </span>
              <em>{entry.points} XP</em>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function Dashboard({ data, user, logout, soundEnabled, toggleSound }) {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview"),
    [sharedPlan, setSharedPlan] = useState(null),
    [syncKey, setSyncKey] = useState(0),
    [liveData, setLiveData] = useState(data),
    [syncError, setSyncError] = useState(""),
    [syncing, setSyncing] = useState(false);
  async function refreshProfile() {
    const { data: current } = await supabase
      .from("app_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(current);
  }
  async function refreshShared() {
    setSyncing(true);
    const [workouts, progress, assessment, bodyGoal] = await Promise.all([
      supabase
        .from("custom_workouts")
        .select("plan,updated_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("progress_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fitness_assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_goals")
        .select("target_weight_kg,target_date")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const failed = [workouts, progress, assessment, bodyGoal].find(
      (result) => result.error,
    );
    setSyncError(
      failed ? "Não foi possível atualizar todos os dados agora." : "",
    );
    setSharedPlan(
      workouts.data?.plan?.length ? workouts.data.plan : buildWeeklyPlan(data),
    );
    const a = assessment.data;
    setLiveData(
      a
        ? {
            ...data,
            goal: a.goal,
            place: a.training_place,
            days: a.training_days,
            level: a.experience_level,
            sex: a.biological_sex || "",
            age: a.age || "",
            height: a.height_cm || "",
            weight: progress.data?.weight_kg || a.weight_kg || "",
            restrictions: a.restrictions || "",
            equipment: a.equipment || "",
            activity: a.activity_level || "Moderadamente ativo",
            meals: a.meals_per_day || 4,
            diet: a.diet_preference || "Sem preferência",
            foodRestrictions: a.food_restrictions || "",
            targetWeight: bodyGoal.data?.target_weight_kg || "",
            targetDate: bodyGoal.data?.target_date || "",
          }
        : {
            ...data,
            weight: progress.data?.weight_kg || data.weight,
            targetWeight: bodyGoal.data?.target_weight_kg || "",
            targetDate: bodyGoal.data?.target_date || "",
          },
    );
    setSyncKey((k) => k + 1);
    setSyncing(false);
  }
  useEffect(() => {
    refreshProfile();
    refreshShared();
    const focus = () => refreshShared();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [user.id]);
  const name = profile?.full_name || user?.user_metadata?.name || "Atleta";
  function selectTab(id) {
    setTab(id);
    refreshShared();
  }
  const plan = sharedPlan || buildWeeklyPlan(liveData);
  let content;
  if (tab === "profile")
    content = (
      <StudentProfile
        user={user}
        profile={profile}
        saved={refreshProfile}
      />
    );
  else if (tab === "coach") content = <StudentCoachLink user={user} />;
  else if (tab === "ranking")
    content = <GameProgress user={user} data={liveData} go={selectTab} />;
  else if (tab === "progress")
    content = (
      <ProgressFull user={user} data={liveData} />
    );
  else if (tab === "nutrition")
    content = (
      <>
        <FirstVisitTip
          id={`nutrition-${user.id}`}
          icon="🥗"
          title="Use a alimentação como guia"
        >
          <p>
            Registre o que consumir em <b>Meu dia</b> para acompanhar o saldo de
            calorias. No cardápio, troque opções e mantenha somente alimentos
            compatíveis com suas restrições.
          </p>
        </FirstVisitTip>
        <NutritionSimple data={liveData} user={user} />
      </>
    );
  else if (tab === "workouts")
    content = (
      <WorkoutsFlexible key={`workouts-${syncKey}`} plan={plan} user={user} />
    );
  else
    content = (
      <OverviewPage
        key={`overview-${syncKey}`}
        data={liveData}
        user={user}
        plan={plan}
        go={selectTab}
      />
    );
  const items = [
    [Home, "overview", "Início"],
    [Dumbbell, "workouts", "Treinos"],
    [Salad, "nutrition", "Alimentação"],
    [LineChart, "progress", "Progresso"],
    [Trophy, "ranking", "Temporada"],
    [UserRound, "coach", "Personal"],
  ];
  return (
    <div className="dash studentDash theme-arcade">
      <aside>
        <Logo />
        <div className="menu">
          {items.map(([Icon, id, label]) => (
            <button
              className={tab === id ? "current" : ""}
              onClick={() => selectTab(id)}
              key={id}
            >
              <Icon />
              {label}
            </button>
          ))}
          <button
            className={tab === "profile" ? "current" : ""}
            onClick={() => setTab("profile")}
          >
            <Camera />
            Editar perfil
          </button>
          <button onClick={logout}>Sair</button>
        </div>
        <button className="profile" onClick={() => setTab("profile")}>
          <span>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div>
            <b>{name}</b>
            <small>{liveData.level} • Editar</small>
          </div>
        </button>
      </aside>
      <div className="dashMain">
        <header className="appHeader">
          <div>
            <span>SEU PLANO EVOQUEST</span>
            <h1>
              {tab === "profile"
                ? "Editar perfil"
                : tab === "coach"
                  ? "Meu personal"
                  : tab === "progress"
                    ? "Seu progresso"
                    : tab === "ranking"
                      ? "Sua temporada"
                    : tab === "nutrition"
                      ? "Sua alimentação"
                      : tab === "workouts"
                        ? "Seus treinos"
                        : `Olá, ${name}.`}
            </h1>
          </div>
          <div className="dashHeaderActions">
            {tab !== "overview" && (
              <EvoquestSpriteScene
                scene="header"
                action={
                  tab === "workouts"
                    ? "strength"
                    : tab === "nutrition"
                      ? "water"
                      : tab === "coach"
                        ? "coach"
                        : "victory"
                }
              />
            )}
            <button
              className="mobileCoachShortcut"
              onClick={() => selectTab("coach")}
              aria-label="Abrir área do personal"
            >
              <UserRound />
            </button>
            <button
              className="mobileProfileShortcut"
              onClick={() => setTab("profile")}
              aria-label="Abrir meu perfil"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </button>
            <button
              className="mobileLogoutShortcut"
              onClick={() => window.confirm("Deseja sair da sua conta EVOQUEST?") && logout()}
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut />
            </button>
            <SettingsMenu enabled={soundEnabled} toggle={toggleSound} />
          </div>
        </header>
        {syncError && (
          <div className="syncWarning">
            <AlertTriangle />
            <span>{syncError}</span>
            <button disabled={syncing} onClick={refreshShared}>
              {syncing ? "Sincronizando..." : "Tentar novamente"}
            </button>
          </div>
        )}
        {content}
        <p className="disclaimer">
          Estimativas educativas. A EVOQUEST não substitui profissionais de saúde.
        </p>
      </div>
      <nav className="mobileNav">
        {items.slice(0, 5).map(([Icon, id, label]) => (
          <button
            className={tab === id ? "current" : ""}
            onClick={() => selectTab(id)}
            key={id}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function weeklyMenu(data) {
  const base = mealOptions(data.diet);
  return [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ].map((day, d) => ({
    day,
    meals: base.slice(0, Number(data.meals) || 4).map((meal, i) => ({
      name: meal.name,
      option: meal.choices[(d + i) % meal.choices.length],
    })),
  }));
}

function shoppingList(data) {
  const vegan = data.diet === "Vegana",
    veg = data.diet === "Vegetariana";
  const protein = vegan
    ? [
        "Tofu — 700 g",
        "Grão-de-bico — 500 g",
        "Lentilha — 500 g",
        "Proteína de soja — 400 g",
      ]
    : veg
      ? [
          "Ovos — 20 unidades",
          "Iogurte natural — 7 unidades",
          "Tofu — 500 g",
          "Grão-de-bico — 500 g",
        ]
      : [
          "Peito de frango — 1,2 kg",
          "Ovos — 20 unidades",
          "Carne magra — 600 g",
          "Atum ou peixe — 600 g",
          "Iogurte natural — 7 unidades",
        ];
  return [
    { category: "Proteínas", items: protein },
    {
      category: "Carboidratos",
      items: [
        "Arroz — 1 kg",
        "Feijão — 500 g",
        "Aveia — 500 g",
        "Pão integral — 1 pacote",
        "Batata — 1 kg",
      ],
    },
    {
      category: "Hortifruti",
      items: [
        "Banana — 10 unidades",
        "Frutas variadas — 7 unidades",
        "Folhas — 3 maços",
        "Tomate — 6 unidades",
        "Legumes variados — 2 kg",
      ],
    },
    {
      category: "Complementos",
      items: [
        "Azeite — 1 frasco",
        "Chia — 150 g",
        "Castanhas — 200 g",
        vegan ? "Bebida vegetal — 2 L" : "Leite — 2 L",
      ],
    },
  ];
}

function NutritionPlanV14({ data }) {
  return <NutritionPlanV15 data={data} />;
}

const foodDb = [
  ["Arroz cozido", 130, 2.7, 28, "Carboidratos"],
  ["Feijão cozido", 76, 4.8, 14, "Carboidratos"],
  ["Aveia", 389, 17, 66, "Carboidratos"],
  ["Pão integral", 247, 13, 41, "Carboidratos"],
  ["Batata cozida", 87, 1.9, 20, "Carboidratos"],
  ["Batata-doce", 86, 1.6, 20, "Carboidratos"],
  ["Macarrão integral", 149, 5.5, 30, "Carboidratos"],
  ["Quinoa cozida", 120, 4.4, 21, "Carboidratos"],
  ["Frango grelhado", 165, 31, 0, "Proteínas"],
  ["Carne magra", 217, 26, 0, "Proteínas"],
  ["Peixe grelhado", 128, 26, 0, "Proteínas"],
  ["Atum", 132, 29, 0, "Proteínas"],
  ["Ovo", 143, 13, 1, "Proteínas"],
  ["Iogurte natural", 61, 3.5, 4.7, "Proteínas"],
  ["Tofu", 76, 8, 1.9, "Proteínas"],
  ["Lentilha cozida", 116, 9, 20, "Proteínas"],
  ["Grão-de-bico", 164, 8.9, 27, "Proteínas"],
  ["Proteína de soja", 335, 52, 31, "Proteínas"],
  ["Banana", 89, 1.1, 23, "Hortifruti"],
  ["Maçã", 52, 0.3, 14, "Hortifruti"],
  ["Mamão", 43, 0.5, 11, "Hortifruti"],
  ["Legumes variados", 45, 2, 9, "Hortifruti"],
  ["Salada verde", 20, 1.5, 3, "Hortifruti"],
  ["Tomate", 18, 0.9, 3.9, "Hortifruti"],
  ["Leite", 61, 3.2, 4.8, "Complementos"],
  ["Bebida vegetal", 45, 1, 7, "Complementos"],
  ["Castanhas", 607, 20, 21, "Complementos"],
  ["Pasta de amendoim", 588, 25, 20, "Complementos"],
  ["Chia", 486, 17, 42, "Complementos"],
  ["Azeite", 884, 0, 0, "Complementos"],
  ["Homus", 166, 7.9, 14, "Complementos"],
  ["Queijo branco", 264, 17, 3, "Proteínas"],
].map(([name, kcal, protein, carbs, category]) => ({
  name,
  kcal,
  protein,
  carbs,
  category,
}));
const normalize = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function restrictionTerms(text) {
  const raw = normalize(text);
  const groups = {
    lactose: ["leite", "iogurte", "queijo"],
    leite: ["leite", "iogurte", "queijo"],
    gluten: ["pao", "macarrao", "aveia"],
    amendoim: ["amendoim"],
    ovo: ["ovo", "omelete"],
    ovos: ["ovo", "omelete"],
    peixe: ["peixe", "atum"],
    frutos: ["castanhas", "amendoim"],
    soja: ["soja", "tofu"],
    carne: ["carne"],
    frango: ["frango"],
  };
  return [
    ...new Set(
      Object.entries(groups)
        .flatMap(([key, values]) => (raw.includes(key) ? values : []))
        .concat(
          raw
            .split(/[,;]+/)
            .map((v) => v.trim())
            .filter((v) => v.length > 2),
        ),
    ),
  ];
}
function allowedFood(text, restrictions) {
  const n = normalize(text);
  return !restrictionTerms(restrictions).some((term) => n.includes(term));
}
function expandedMealOptions(diet, restrictions) {
  const vegan = diet === "Vegana",
    veg = diet === "Vegetariana";
  const names = [
    "Café da manhã",
    "Almoço",
    "Lanche",
    "Jantar",
    "Ceia",
    "Lanche extra",
  ];
  const pools = {
    breakfast: vegan
      ? [
          "Aveia com bebida vegetal, banana e chia",
          "Pão integral com homus e mamão",
          "Tofu mexido com batata e fruta",
          "Vitamina de banana com bebida vegetal e aveia",
          "Tapioca com homus e tomate",
          "Bowl de frutas, chia e castanhas",
        ]
      : veg
        ? [
            "Iogurte, aveia, banana e chia",
            "Omelete com pão integral e fruta",
            "Tapioca com queijo branco e mamão",
            "Vitamina de banana com leite e aveia",
            "Ovos mexidos com batata e fruta",
            "Pão integral com queijo e tomate",
          ]
        : [
            "Ovos, pão integral e fruta",
            "Iogurte, aveia e banana",
            "Tapioca com frango e fruta",
            "Vitamina de banana com leite e aveia",
            "Omelete com queijo e tomate",
            "Pão integral com atum e fruta",
          ],
    main: vegan
      ? [
          "Arroz, feijão, tofu e salada",
          "Quinoa, lentilha e legumes",
          "Macarrão integral com proteína de soja",
          "Batata-doce, grão-de-bico e salada",
          "Arroz, lentilha e legumes",
          "Bowl de quinoa, tofu e tomate",
        ]
      : veg
        ? [
            "Arroz, feijão, ovos e salada",
            "Quinoa, grão-de-bico e legumes",
            "Macarrão integral com tofu",
            "Batata-doce, omelete e salada",
            "Arroz, lentilha e queijo branco",
            "Bowl de quinoa, ovos e tomate",
          ]
        : [
            "Arroz, feijão, frango e salada",
            "Batata, carne magra e legumes",
            "Macarrão integral com atum e salada",
            "Batata-doce, peixe e legumes",
            "Quinoa, frango e tomate",
            "Arroz, carne magra e salada",
          ],
    snack: vegan
      ? [
          "Banana, castanhas e bebida vegetal",
          "Sanduíche de homus e tomate",
          "Vitamina com bebida vegetal e chia",
          "Fruta com aveia e sementes",
          "Grão-de-bico crocante e fruta",
          "Pão integral com tofu temperado",
        ]
      : veg
        ? [
            "Iogurte com fruta e aveia",
            "Sanduíche de queijo branco",
            "Vitamina de banana com leite",
            "Ovo cozido e fruta",
            "Tapioca com queijo",
            "Pão integral com omelete",
          ]
        : [
            "Iogurte com fruta e aveia",
            "Sanduíche de frango",
            "Fruta com pasta de amendoim",
            "Atum com pão integral",
            "Ovos cozidos e fruta",
            "Vitamina de banana com leite",
          ],
    supper: vegan
      ? [
          "Fruta com sementes",
          "Bebida vegetal com aveia",
          "Homus com cenoura",
          "Banana com chia",
          "Tofu grelhado com tomate",
          "Castanhas e maçã",
        ]
      : veg
        ? [
            "Iogurte natural",
            "Leite com aveia",
            "Queijo branco e fruta",
            "Ovo cozido e tomate",
            "Vitamina de fruta",
            "Omelete pequeno",
          ]
        : [
            "Iogurte natural",
            "Leite com aveia",
            "Ovos cozidos e fruta",
            "Atum com tomate",
            "Queijo branco e fruta",
            "Frango desfiado com legumes",
          ],
  };
  const kinds = ["breakfast", "main", "snack", "main", "supper", "snack"];
  return names.map((name, i) => {
    const safe = pools[kinds[i]].filter((x) => allowedFood(x, restrictions));
    return {
      name,
      choices: safe.length
        ? safe
        : [
            "Opção personalizada sem os alimentos restringidos — confirme com nutricionista",
          ],
    };
  });
}
function weeklyMenuV15(data) {
  const base = expandedMealOptions(data.diet, data.foodRestrictions);
  return [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ].map((day, d) => ({
    day,
    meals: base.slice(0, Number(data.meals) || 4).map((meal, i) => ({
      name: meal.name,
      option: meal.choices[(d + i) % meal.choices.length],
    })),
  }));
}
function shoppingFromMenu(menu) {
  const corpus = normalize(
    menu.flatMap((d) => d.meals.map((m) => m.option)).join(" "),
  );
  return ["Proteínas", "Carboidratos", "Hortifruti", "Complementos"]
    .map((category) => ({
      category,
      items: foodDb
        .filter(
          (f) =>
            f.category === category &&
            corpus.includes(normalize(f.name).split(" ")[0]),
        )
        .map((f) => f.name),
    }))
    .filter((g) => g.items.length);
}

function NutritionPlanV15({ data }) {
  const targets = calculateNutrition(data),
    menu = weeklyMenuV15(data);
  const [view, setView] = useState("today"),
    [day, setDay] = useState(0),
    [swaps, setSwaps] = useState({}),
    [checked, setChecked] = useState({}),
    [log, setLog] = useState([]),
    [food, setFood] = useState(foodDb[0].name),
    [grams, setGrams] = useState(100);
  const options = expandedMealOptions(data.diet, data.foodRestrictions),
    meals = menu[day].meals.map((m, i) => ({
      ...m,
      option:
        options[i].choices[
          swaps[`${day}-${i}`] ?? options[i].choices.indexOf(m.option)
        ] || options[i].choices[0],
    }));
  const list = shoppingFromMenu(menu),
    consumed = Math.round(log.reduce((s, x) => s + x.kcal, 0)),
    protein = Math.round(log.reduce((s, x) => s + x.protein, 0)),
    carbs = Math.round(log.reduce((s, x) => s + x.carbs, 0)),
    remaining = Math.max(0, targets.calories - consumed),
    allItems = list.flatMap((g) => g.items),
    bought = allItems.filter((item) => checked[item]).length;
  function swap(i) {
    setSwaps({
      ...swaps,
      [`${day}-${i}`]:
        ((swaps[`${day}-${i}`] ?? options[i].choices.indexOf(meals[i].option)) +
          1) %
        options[i].choices.length,
    });
  }
  function addFood(e) {
    e.preventDefault();
    const item = foodDb.find((f) => f.name === food),
      factor = (Number(grams) || 0) / 100;
    if (!item || factor <= 0) return;
    setLog([
      ...log,
      {
        id: Date.now(),
        name: item.name,
        grams: +grams,
        kcal: item.kcal * factor,
        protein: item.protein * factor,
        carbs: item.carbs * factor,
      },
    ]);
  }
  return (
    <section className="nutritionPage">
      <div className="macroGrid dailyBalance">
        <article>
          <small>FALTAM HOJE</small>
          <b>{remaining} kcal</b>
          <span>meta {targets.calories} kcal</span>
        </article>
        <article>
          <small>CONSUMIDAS</small>
          <b>{consumed} kcal</b>
          <span>
            {Math.min(100, Math.round((consumed / targets.calories) * 100))}% da
            meta
          </span>
        </article>
        <article>
          <small>PROTEÍNAS</small>
          <b>
            {protein}/{targets.protein} g
          </b>
          <span>consumo / meta</span>
        </article>
        <article>
          <small>CARBOIDRATOS</small>
          <b>
            {carbs}/{targets.carbs} g
          </b>
          <span>consumo / meta</span>
        </article>
      </div>
      <div className="calorieProgress">
        <i
          style={{
            width: `${Math.min(100, (consumed / targets.calories) * 100)}%`,
          }}
        />
      </div>
      {data.foodRestrictions && (
        <div className="foodAlert">
          <AlertTriangle />
          <div>
            <b>Filtro ativo: {data.foodRestrictions}</b>
            <span>
              As sugestões incompatíveis foram removidas automaticamente. Em
              alergias graves, confirme ingredientes e rótulos.
            </span>
          </div>
        </div>
      )}
      <div className="nutritionTabs">
        <button
          className={view === "today" ? "active" : ""}
          onClick={() => setView("today")}
        >
          Cardápio
        </button>
        <button
          className={view === "diary" ? "active" : ""}
          onClick={() => setView("diary")}
        >
          Diário alimentar
        </button>
        <button
          className={view === "shopping" ? "active" : ""}
          onClick={() => setView("shopping")}
        >
          Compras
        </button>
      </div>
      {view === "today" ? (
        <>
          <div className="daySelector">
            {menu.map((m, i) => (
              <button
                className={day === i ? "active" : ""}
                onClick={() => setDay(i)}
                key={m.day}
              >
                <span>{m.day.slice(0, 3)}</span>
                <b>{i + 1}</b>
              </button>
            ))}
          </div>
          <div className="portionGuide">
            <b>
              {options.reduce((s, m) => s + m.choices.length, 0)} combinações
              disponíveis
            </b>
            <span>
              Meta aproximada: {Math.round(targets.calories / meals.length)}{" "}
              kcal por refeição
            </span>
          </div>
          <div className="mealGrid">
            {meals.map((meal, i) => (
              <article className="mealCard" key={meal.name}>
                <div>
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>
                    <b>{meal.name}</b>
                    <small>
                      {Math.round(targets.calories / meals.length)} kcal como
                      referência
                    </small>
                  </span>
                </div>
                <p>{meal.option}</p>
                <button onClick={() => swap(i)}>Trocar opção</button>
              </article>
            ))}
          </div>
        </>
      ) : view === "diary" ? (
        <div className="foodDiary">
          <form onSubmit={addFood}>
            <h2>Registrar o que comeu</h2>
            <label>
              Alimento
              <select value={food} onChange={(e) => setFood(e.target.value)}>
                {foodDb
                  .filter((f) => allowedFood(f.name, data.foodRestrictions))
                  .map((f) => (
                    <option key={f.name}>{f.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Quantidade (g ou ml)
              <input
                type="number"
                min="1"
                max="3000"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </label>
            <button className="primary">Adicionar</button>
          </form>
          <div className="foodLog">
            <h2>Consumo de hoje</h2>
            {log.length ? (
              log.map((x) => (
                <article key={x.id}>
                  <span>
                    <b>{x.name}</b>
                    <small>
                      {x.grams} g • {Math.round(x.protein)} g proteína
                    </small>
                  </span>
                  <strong>{Math.round(x.kcal)} kcal</strong>
                  <button
                    onClick={() => setLog(log.filter((i) => i.id !== x.id))}
                  >
                    Excluir
                  </button>
                </article>
              ))
            ) : (
              <p>Nenhum alimento registrado hoje.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="shoppingPurpose">
            <div>
              <span>LISTA CRIADA PELO SEU CARDÁPIO</span>
              <h2>
                {bought} de {allItems.length} itens comprados
              </h2>
              <p>
                Marque durante a compra. A lista contém apenas ingredientes
                usados nas sugestões da semana e respeita suas restrições.
              </p>
            </div>
            <b>
              {allItems.length
                ? Math.round((bought / allItems.length) * 100)
                : 0}
              %
            </b>
          </div>
          <div className="shoppingGrid">
            {list.map((group) => (
              <section key={group.category}>
                <h3>{group.category}</h3>
                {group.items.map((item) => (
                  <label className={checked[item] ? "checked" : ""} key={item}>
                    <input
                      type="checkbox"
                      checked={!!checked[item]}
                      onChange={() =>
                        setChecked({ ...checked, [item]: !checked[item] })
                      }
                    />
                    <span>{item} — para 7 dias</span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
      <div className="nutritionGuide">
        <b>Orientação educativa</b>
        <p>
          Calorias e porções são estimativas. O registro diário fica apenas
          nesta tela nesta versão; condições clínicas e alergias exigem
          acompanhamento profissional.
        </p>
      </div>
    </section>
  );
}

const workoutAlternatives = {
  "Agachamento livre": [
    "Agachamento goblet",
    "Leg press",
    "Afundo alternado",
    "Agachamento no banco",
  ],
  "Agachamento guiado": [
    "Agachamento livre",
    "Leg press",
    "Hack squat",
    "Agachamento goblet",
  ],
  "Supino com halteres": [
    "Supino máquina",
    "Flexão de braços",
    "Supino com barra",
    "Crucifixo máquina",
  ],
  "Flexão de braços": [
    "Flexão inclinada",
    "Supino com halteres",
    "Flexão com joelhos apoiados",
    "Crucifixo com elástico",
  ],
  "Puxada frontal": [
    "Barra fixa assistida",
    "Remada sentada",
    "Puxada neutra",
    "Pulldown unilateral",
  ],
  "Remada sentada": [
    "Remada unilateral",
    "Remada máquina",
    "Remada com halteres",
    "Puxada frontal",
  ],
  "Remada com mochila": [
    "Remada com elástico",
    "Remada unilateral apoiada",
    "Crucifixo inverso",
    "Puxada com elástico",
  ],
  "Levantamento terra romeno": [
    "Mesa flexora",
    "Ponte de glúteos",
    "Stiff com halteres",
    "Good morning",
  ],
  "Desenvolvimento de ombros": [
    "Desenvolvimento máquina",
    "Elevação lateral",
    "Arnold press",
    "Desenvolvimento com halteres",
  ],
  "Ponte de glúteos": [
    "Elevação pélvica",
    "Levantamento romeno com mochila",
    "Afundo alternado",
    "Agachamento sumô",
  ],
};
function alternativesFor(name, home) {
  const direct = workoutAlternatives[name];
  if (direct) return direct;
  return home
    ? [
        "Agachamento no banco",
        "Flexão inclinada",
        "Remada com elástico",
        "Ponte de glúteos",
        "Prancha",
      ]
    : [
        "Leg press",
        "Supino máquina",
        "Remada máquina",
        "Cadeira flexora",
        "Elevação lateral",
      ];
}
function WorkoutsPageV15({ plan, user, data }) {
  const [active, setActive] = useState(null),
    [history, setHistory] = useState([]),
    [logs, setLogs] = useState([]),
    [editing, setEditing] = useState(null),
    [custom, setCustom] = useState(() => {
      try {
        return (
          JSON.parse(readEvoquestStorage(`plan-${user.id}`)) || plan
        );
      } catch {
        return plan;
      }
    });
  async function load() {
    const [s, l] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase
        .from("workout_exercise_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setHistory(s.data || []);
    setLogs(l.data || []);
  }
  useEffect(() => {
    load();
  }, []);
  const lastByExercise = {};
  logs.forEach((l) => {
    if (!lastByExercise[l.exercise_name]) lastByExercise[l.exercise_name] = l;
  });
  function replace(wi, ii, name) {
    const next = custom.map((w, a) =>
      a === wi
        ? {
            ...w,
            items: w.items.map((item, b) =>
              b === ii ? { ...item, name } : item,
            ),
          }
        : w,
    );
    setCustom(next);
    localStorage.setItem(`evoquest-plan-${user.id}`, JSON.stringify(next));
    setEditing(null);
  }
  if (active)
    return (
      <WorkoutExecution
        workout={active}
        user={user}
        onClose={() => setActive(null)}
        onSaved={load}
        lastByExercise={lastByExercise}
      />
    );
  return (
    <section className="workoutPlan">
      <div className="planIntro">
        <p>
          Seu plano tem{" "}
          <b>{custom.reduce((s, w) => s + w.items.length, 0)} exercícios</b>.
          Use “Trocar” quando não gostar de um movimento.
        </p>
        <span>{history.length} sessões</span>
      </div>
      <div className="workoutGrid">
        {custom.map((workout, wi) => (
          <article className="workoutCard executable" key={workout.id}>
            <div className="workoutTitle">
              <span>{workout.day}</span>
              <b>Treino {workout.id}</b>
              <h2>{workout.title}</h2>
            </div>
            {workout.items.map((item, ii) => (
              <div
                className="workoutItem editableExercise"
                key={`${ii}-${item.name}`}
              >
                <i>{ii + 1}</i>
                <div>
                  <b>{item.name}</b>
                  <small>
                    {lastByExercise[item.name]
                      ? `Último: ${lastByExercise[item.name].weight_kg || "—"} kg × ${lastByExercise[item.name].repetitions || "—"} reps`
                      : item.detail}
                  </small>
                  {editing === `${wi}-${ii}` && (
                    <select
                      autoFocus
                      onChange={(e) => replace(wi, ii, e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Escolha a substituição
                      </option>
                      {alternativesFor(item.name, data.place === "Em casa")
                        .filter((x) => x !== item.name)
                        .map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={() =>
                    setEditing(editing === `${wi}-${ii}` ? null : `${wi}-${ii}`)
                  }
                >
                  Trocar
                </button>
              </div>
            ))}
            <button className="primary" onClick={() => setActive(workout)}>
              Iniciar treino <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      <div className="sessionHistory">
        <div className="historyTitle">
          <h2>Desempenho recente</h2>
          <span>{history.length} sessões</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((s) => (
            <article key={s.id}>
              <div>
                <b>
                  Treino {s.workout_code} — {s.workout_title}
                </b>
                <small>
                  {new Date(s.completed_at).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <span>
                {Math.round((s.completed_exercises / s.total_exercises) * 100)}%
                concluído
              </span>
            </article>
          ))
        ) : (
          <p className="emptyHistory">
            Seu histórico aparecerá após o primeiro treino.
          </p>
        )}
      </div>
    </section>
  );
}

const foodCatalog = tacoFoods;
function forbiddenWords(text) {
  const t = (text || "").toLowerCase(),
    words = t
      .split(/[,;\n]| e /)
      .map((x) => x.trim())
      .filter((x) => x.length > 2);
  const groups = {
    lactose: ["leite", "iogurte", "queijo"],
    gluten: ["pão", "aveia", "macarrão"],
    amendoim: ["amendoim", "pasta de amendoim"],
    peixe: ["peixe", "atum"],
    ovo: ["ovo", "omelete"],
    soja: ["tofu", "soja"],
    castanha: ["castanha"],
    frango: ["frango"],
  };
  Object.entries(groups).forEach(([k, v]) => {
    if (t.includes(k)) words.push(...v);
  });
  return [...new Set(words)];
}
function allowed(text, data) {
  const lower = text.toLowerCase(),
    blocked = forbiddenWords(data.foodRestrictions);
  return !blocked.some((w) => lower.includes(w));
}
function foodMacros(food, grams) {
  if (food?.length >= 6) {
    const amount = Number(grams) / 100;
    return {
      protein: +(food[3] * amount).toFixed(1),
      carbs: +(food[4] * amount).toFixed(1),
      fats: +(food[5] * amount).toFixed(1),
    };
  }
  const category = food?.[2] || "Complementos";
  const amount = Number(grams) / 100;
  const profiles = {
    Proteínas: [26, 2, 7],
    Carboidratos: [4, 25, 1],
    Hortifruti: [1, 10, 0.3],
    Complementos: [6, 8, 10],
  };
  const [protein, carbs, fats] = profiles[category] || profiles.Complementos;
  return {
    protein: +(protein * amount).toFixed(1),
    carbs: +(carbs * amount).toFixed(1),
    fats: +(fats * amount).toFixed(1),
  };
}
function richerMeals(data) {
  const vegan = data.diet === "Vegana",
    veg = data.diet === "Vegetariana";
  const all = [
    {
      name: "Café da manhã",
      choices: vegan
        ? [
            "Aveia com bebida vegetal, banana e chia",
            "Tofu mexido com pão integral e fruta",
            "Vitamina de banana com bebida vegetal",
            "Cuscuz com tofu e tomate",
            "Pão integral com homus e fruta",
          ]
        : veg
          ? [
              "Iogurte com aveia, banana e chia",
              "Omelete com pão integral e fruta",
              "Tapioca com queijo e fruta",
              "Cuscuz com ovos e tomate",
              "Panqueca de banana e aveia",
            ]
          : [
              "Ovos com pão integral e fruta",
              "Iogurte com aveia e banana",
              "Tapioca com frango e fruta",
              "Cuscuz com ovos e tomate",
              "Sanduíche de atum e fruta",
            ],
    },
    {
      name: "Almoço",
      choices: vegan
        ? [
            "Arroz, feijão, tofu e salada",
            "Quinoa, lentilha e legumes",
            "Macarrão com proteína de soja",
            "Grão-de-bico, batata e vegetais",
            "Feijoada vegetariana com arroz",
          ]
        : veg
          ? [
              "Arroz, feijão, ovos e salada",
              "Quinoa, grão-de-bico e legumes",
              "Macarrão com tofu",
              "Omelete, batata e vegetais",
              "Lentilha, arroz e queijo grelhado",
            ]
          : [
              "Arroz, feijão, frango e salada",
              "Batata, carne magra e legumes",
              "Macarrão com atum e salada",
              "Peixe, arroz e vegetais",
              "Carne moída, feijão e batata",
            ],
    },
    {
      name: "Lanche",
      choices: vegan
        ? [
            "Fruta, castanhas e proteína vegetal",
            "Sanduíche de homus",
            "Vitamina com bebida vegetal",
            "Aveia com banana e chia",
            "Tapioca com tofu",
          ]
        : veg
          ? [
              "Iogurte com fruta e aveia",
              "Sanduíche de queijo branco",
              "Vitamina de banana",
              "Ovos cozidos com fruta",
              "Tapioca com queijo",
            ]
          : [
              "Iogurte com fruta e aveia",
              "Sanduíche de frango",
              "Fruta com pasta de amendoim",
              "Ovos cozidos e fruta",
              "Tapioca com atum",
            ],
    },
    {
      name: "Jantar",
      choices: vegan
        ? [
            "Bowl de grão-de-bico e legumes",
            "Sopa de lentilha com torradas",
            "Arroz, feijão e tofu",
            "Macarrão com soja e vegetais",
            "Hambúrguer de lentilha e batata",
          ]
        : veg
          ? [
              "Omelete com legumes e arroz",
              "Sopa de lentilha com torradas",
              "Arroz, feijão e tofu",
              "Macarrão com queijo e vegetais",
              "Hambúrguer de grão-de-bico",
            ]
          : [
              "Frango, batata e legumes",
              "Omelete com arroz e salada",
              "Peixe, arroz e vegetais",
              "Carne magra com purê",
              "Sopa de frango e legumes",
            ],
    },
    {
      name: "Ceia",
      choices: [
        "Fruta com aveia",
        "Vitamina leve",
        "Sanduíche integral simples",
        "Iogurte ou alternativa vegetal",
        "Banana com canela",
      ],
    },
    {
      name: "Lanche extra",
      choices: [
        "Fruta e fonte de proteína",
        "Sanduíche integral",
        "Aveia com fruta",
        "Tapioca recheada",
        "Porção de castanhas e fruta",
      ],
    },
  ];
  const suggested = recipesFor(data);
  return all.map((m) => {
    const recipeChoices = suggested
      .filter((recipe) => recipe.type === m.name)
      .filter((recipe) => allowed(recipe.name + " " + recipe.ingredients.join(" "), data))
      .map((recipe) => `${recipe.name} — ${recipe.kcal} kcal • ${recipe.protein} g proteína`);
    const filtered = m.choices.filter((x) => allowed(x, data));
    return {
      ...m,
      choices: recipeChoices.length || filtered.length
        ? [...recipeChoices, ...filtered]
        : ["Fruta, arroz, feijão e vegetais compatíveis com suas restrições"],
    };
  });
}

function NutritionPlan({ data, user }) {
  const targets = calculateNutrition(data),
    meals = richerMeals(data).slice(0, Number(data.meals) || 4),
    today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState("day"),
    [choices, setChoices] = useState({}),
    [logs, setLogs] = useState([]),
    [food, setFood] = useState("Arroz cozido"),
    [grams, setGrams] = useState(100),
    [checked, setChecked] = useState({});
  async function load() {
    const { data: rows } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("consumed_on", today)
      .order("created_at", { ascending: false });
    setLogs(rows || []);
  }
  useEffect(() => {
    load();
  }, []);
  const catalog = foodCatalog.filter(([name]) => allowed(name, data)),
    selected = catalog.find((x) => x[0] === food) || catalog[0],
    consumed = Math.round(logs.reduce((s, l) => s + Number(l.calories), 0)),
    remaining = Math.max(0, targets.calories - consumed);
  async function add(e) {
    e.preventDefault();
    const calories = Math.round((Number(grams) * selected[1]) / 100);
    await supabase.from("food_logs").insert({
      user_id: user.id,
      food_name: selected[0],
      grams: +grams,
      calories,
      consumed_on: today,
    });
    load();
  }
  async function remove(id) {
    await supabase.from("food_logs").delete().eq("id", id);
    load();
  }
  const weekly = meals
      .flatMap((m, i) => m.choices.slice(0, Math.min(3, m.choices.length)))
      .filter((v, i, a) => a.indexOf(v) === i),
    ingredients = catalog
      .filter(
        ([name]) =>
          weekly.some((x) =>
            x.toLowerCase().includes(name.split(" ")[0].toLowerCase()),
          ) ||
          [
            "Arroz cozido",
            "Feijão cozido",
            "Banana",
            "Legumes",
            "Salada",
          ].includes(name),
      )
      .map((x) => x[0]);
  return (
    <section className="nutritionPage">
      <div className="calorieBalance">
        <div>
          <span>META DO DIA</span>
          <b>{targets.calories} kcal</b>
        </div>
        <div>
          <span>CONSUMIDO</span>
          <b>{consumed} kcal</b>
        </div>
        <div className="remaining">
          <span>AINDA FALTAM</span>
          <b>{remaining} kcal</b>
        </div>
        <i>
          <em
            style={{
              width: `${Math.min(100, (consumed / targets.calories) * 100)}%`,
            }}
          />
        </i>
      </div>
      {data.foodRestrictions && (
        <div className="foodAlert">
          <AlertTriangle />
          <div>
            <b>Filtro ativo: {data.foodRestrictions}</b>
            <span>
              Opções com termos associados à restrição foram removidas. Para
              alergias graves, confirme ingredientes e rótulos: filtros
              automáticos não garantem ausência de contaminação.
            </span>
          </div>
        </div>
      )}
      <div className="nutritionTabs">
        {[
          ["day", "Meu dia"],
          ["menu", "Cardápio"],
          ["shopping", "Compras"],
        ].map(([id, label]) => (
          <button
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "day" && (
        <div className="foodDiary">
          <form onSubmit={add}>
            <h2>Registrar alimento</h2>
            <label>
              Alimento
              <select
                value={selected?.[0]}
                onChange={(e) => setFood(e.target.value)}
              >
                {catalog.map((x) => (
                  <option key={x[0]}>{x[0]}</option>
                ))}
              </select>
            </label>
            <label>
              Quantidade (g)
              <input
                type="number"
                min="1"
                max="3000"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </label>
            <div>
              <b>
                {Math.round((Number(grams) * (selected?.[1] || 0)) / 100)} kcal
              </b>
              <button className="primary">Adicionar</button>
            </div>
          </form>
          <section>
            <h2>Consumido hoje</h2>
            {logs.length ? (
              logs.map((l) => (
                <article key={l.id}>
                  <span>
                    <b>{l.food_name}</b>
                    <small>{l.grams} g</small>
                  </span>
                  <strong>{l.calories} kcal</strong>
                  <button onClick={() => remove(l.id)}>Excluir</button>
                </article>
              ))
            ) : (
              <p>Nenhum alimento registrado hoje.</p>
            )}
          </section>
        </div>
      )}
      {view === "menu" && (
        <div className="mealGrid">
          {meals.map((meal, i) => (
            <article className="mealCard" key={meal.name}>
              <div>
                <i>{String(i + 1).padStart(2, "0")}</i>
                <span>
                  <b>{meal.name}</b>
                  <small>
                    {Math.round(targets.calories / meals.length)} kcal de
                    referência
                  </small>
                </span>
              </div>
              <p>{meal.choices[choices[i] || 0]}</p>
              <button
                onClick={() =>
                  setChoices({
                    ...choices,
                    [i]: ((choices[i] || 0) + 1) % meal.choices.length,
                  })
                }
              >
                Trocar entre {meal.choices.length} opções
              </button>
            </article>
          ))}
        </div>
      )}
      {view === "shopping" && (
        <div className="smartShopping">
          <header>
            <div>
              <h2>Compras do seu cardápio</h2>
              <p>Gerada apenas com alimentos compatíveis com o seu perfil.</p>
            </div>
            <b>
              {Object.values(checked).filter(Boolean).length}/
              {ingredients.length}
            </b>
          </header>
          {ingredients.map((item) => (
            <label className={checked[item] ? "checked" : ""} key={item}>
              <input
                type="checkbox"
                checked={!!checked[item]}
                onChange={() =>
                  setChecked({ ...checked, [item]: !checked[item] })
                }
              />
              <span>
                <b>{item}</b>
                <small>Quantidade para aproximadamente 7 dias</small>
              </span>
            </label>
          ))}
          <div className="shoppingLogic">
            Ao trocar sua preferência ou restrição no perfil, esta lista é
            recalculada automaticamente.
          </div>
        </div>
      )}
    </section>
  );
}

const exercisePool = [
  "Agachamento livre",
  "Agachamento goblet",
  "Leg press",
  "Afundo alternado",
  "Ponte de glúteos",
  "Levantamento terra romeno",
  "Cadeira flexora",
  "Panturrilha em pé",
  "Supino com halteres",
  "Flexão de braços",
  "Desenvolvimento de ombros",
  "Elevação lateral",
  "Puxada frontal",
  "Remada sentada",
  "Remada com mochila",
  "Face pull",
  "Rosca direta",
  "Tríceps na polia",
  "Prancha",
];
function WorkoutsPage({ plan, user }) {
  return <WorkoutsSimple plan={plan} user={user} />;
}

function HydrationPanel({ data, user }) {
  const today = new Date().toISOString().slice(0, 10),
    target = calculateHydration(data);
  const [entries, setEntries] = useState([]),
    [message, setMessage] = useState(""),
    [celebrating, setCelebrating] = useState(false),
    [reminder, setReminder] = useState(
      () => Number(readEvoquestStorage(`water-reminder-${user.id}`)) || 0,
    );
  async function loadWater() {
    const { data: rows, error } = await supabase
      .from("hydration_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("consumed_on", today)
      .order("created_at", { ascending: false });
    setEntries(rows || []);
    if (error) setMessage("Execute a migração 020 para registrar sua água.");
  }
  useEffect(() => {
    loadWater();
  }, [user.id]);
  useEffect(() => {
    if (!reminder) return;
    const remind = () => {
      setMessage("Hora de beber água e avançar sua missão diária!");
      if ("Notification" in window && Notification.permission === "granted")
        new Notification("EVOQUEST • Missão de hidratação", {
          body: "Beba água e registre no aplicativo para acompanhar sua meta.",
        });
    };
    const timer = window.setInterval(remind, reminder * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [reminder]);
  async function addWater(amount) {
    setMessage("");
    const { error } = await supabase.from("hydration_logs").insert({
      user_id: user.id,
      amount_ml: Number(amount),
      consumed_on: today,
    });
    if (error) setMessage("Não foi possível registrar. Execute a migração 020.");
    else {
      const completedNow = consumed < target && consumed + Number(amount) >= target;
      setMessage(
        completedNow
          ? "Meta de hidratação concluída! Missão cumprida!"
          : `+${amount} ml registrados.`,
      );
      if (completedNow) {
        setCelebrating(true);
        window.setTimeout(() => setCelebrating(false), 3200);
      }
      loadWater();
    }
  }
  async function undoLast() {
    if (!entries[0]) return;
    await supabase.from("hydration_logs").delete().eq("id", entries[0].id);
    setMessage("Último registro removido.");
    loadWater();
  }
  async function changeReminder(value) {
    const minutes = Number(value);
    if (minutes && "Notification" in window && Notification.permission === "default")
      await Notification.requestPermission();
    setReminder(minutes);
    localStorage.setItem(`evoquest-water-reminder-${user.id}`, String(minutes));
    setMessage(
      minutes
        ? `Lembrete ativado a cada ${minutes} minutos enquanto o EVOQUEST estiver aberto.`
        : "Lembrete de água desativado.",
    );
  }
  const consumed = entries.reduce((sum, entry) => sum + Number(entry.amount_ml), 0),
    percent = Math.min(100, Math.round((consumed / target) * 100)),
    bottleCount = Math.max(1, Math.ceil(target / 500)),
    currentBottle = Math.floor(consumed / 500);
  const completed = consumed >= target;
  return (
    <section className={`hydrationPanel ${completed ? "hydrationComplete" : ""}`}>
      <header>
        <div>
          <span>MISSÃO DE HIDRATAÇÃO</span>
          <h2>Água do dia</h2>
          <p>Meta ajustada ao peso e ao objetivo: {data.goal || "condicionamento"}.</p>
        </div>
        <Droplets className="hydrationDrop" aria-label={completed ? "Meta de água concluída" : "Meta de água em andamento"} />
      </header>
      <div className="hydrationNumbers">
        <b>{consumed.toLocaleString("pt-BR")} ml</b>
        <span>de {target.toLocaleString("pt-BR")} ml</span>
        <strong>{percent}%</strong>
      </div>
      <i className="hydrationProgress">
        <em style={{ width: `${percent}%` }} />
      </i>
      <div className="waterGameHeader">
        <span>FRASCOS DE ÁGUA</span>
        <small>Toque no próximo frasco: cada clique adiciona 250 ml.</small>
      </div>
      <div className="waterFlaskGrid">
        {Array.from({ length: bottleCount }, (_, index) => {
          const fill = Math.max(0, Math.min(500, consumed - index * 500));
          const state = fill >= 500 ? "full" : fill >= 250 ? "half" : "empty";
          const disabled = consumed >= target || fill >= 500 || index > currentBottle;
          return (
            <button
              type="button"
              className={`pixelFlask ${state} ${index === currentBottle && consumed < target ? "next" : ""}`}
              disabled={disabled}
              onClick={() => addWater(250)}
              aria-label={`Frasco de água ${index + 1}: ${fill} de 500 ml`}
              key={index}
            >
              <i className="flaskCork" />
              <i className="flaskNeck" />
              <span className="flaskBody">
                <em className="flaskWater" />
              </span>
              <b>{index + 1}</b>
              <small>{fill}/500</small>
            </button>
          );
        })}
      </div>
      <div className="waterReminder">
        <Bell />
        <label>
          Lembrar de beber água
          <select value={reminder} onChange={(event) => changeReminder(event.target.value)}>
            <option value="0">Desativado</option>
            <option value="60">A cada 60 minutos</option>
            <option value="90">A cada 90 minutos</option>
            <option value="120">A cada 120 minutos</option>
          </select>
        </label>
        <button disabled={!entries.length} onClick={undoLast}>Desfazer último</button>
      </div>
      {message && <div className="waterMessage">{message}</div>}
      {celebrating && (
        <div className="hydrationCelebration" role="status" aria-live="polite">
          <span className="celebrationDrops" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
          </span>
          <SpriteActor character="b" action="water" className="celebrationSprite" />
          <strong>MISSÃO CUMPRIDA!</strong>
          <small>Meta de hidratação concluída</small>
        </div>
      )}
    </section>
  );
}

function GoalCelebration({ type }) {
  const isFood = type === "food";
  return (
    <div
      className={`goalCelebration ${isFood ? "foodGoalCelebration" : "workoutGoalCelebration"}`}
      role="status"
      aria-live="polite"
    >
      <span className="goalParticles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </span>
      <SpriteActor
        character={isFood ? "a" : "b"}
        action={isFood ? "eat" : "victory"}
        className="celebrationSprite"
      />
      <strong>{isFood ? "META DE ALIMENTAÇÃO!" : "TREINO CONCLUÍDO!"}</strong>
      <small>{isFood ? "Objetivo diário alcançado" : "Missão diária cumprida"}</small>
    </div>
  );
}

function NutritionSimple({ data, user }) {
  const targets = calculateNutrition(data),
    today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState("day"),
    [logs, setLogs] = useState([]),
    [food, setFood] = useState("Arroz branco cozido"),
    [grams, setGrams] = useState(100),
    [entryMode, setEntryMode] = useState("food"),
    [recipeName, setRecipeName] = useState(""),
    [servings, setServings] = useState(1),
    [selectedDate, setSelectedDate] = useState(today),
    [query, setQuery] = useState(""),
    [mealType, setMealType] = useState("Refeição"),
    [foodCelebrating, setFoodCelebrating] = useState(false),
    [history, setHistory] = useState([]);
  async function load() {
    const [dayResult, historyResult] = await Promise.all([
      supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("consumed_on", selectedDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte(
          "consumed_on",
          new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
        )
        .order("consumed_on", { ascending: false }),
    ]);
    setLogs(dayResult.data || []);
    setHistory(historyResult.data || []);
  }
  useEffect(() => {
    load();
  }, [selectedDate]);
  const catalog = foodCatalog.filter(
      ([name]) =>
        allowed(name, data) &&
        (!query || normalize(name).includes(normalize(query))),
    ),
    selected = catalog.find((x) => x[0] === food) || catalog[0],
    consumed = Math.round(logs.reduce((s, l) => s + Number(l.calories), 0)),
    remaining = Math.max(0, targets.calories - consumed),
    macros = logs.reduce(
      (total, log) => ({
        protein: total.protein + Number(log.protein_g || 0),
        carbs: total.carbs + Number(log.carbs_g || 0),
        fats: total.fats + Number(log.fats_g || 0),
      }),
      { protein: 0, carbs: 0, fats: 0 },
    ),
    recommendedRecipes = recipesFor(data)
      .filter((recipe) =>
        allowed(recipe.name + " " + recipe.ingredients.join(" "), data),
      )
      .sort((a, b) => {
        const target = targets.calories / Math.max(3, Number(data.meals) || 4);
        return Math.abs(a.kcal - target) - Math.abs(b.kcal - target);
      }),
    selectedRecipe =
      recommendedRecipes.find((recipe) => recipe.name === recipeName) ||
      recommendedRecipes[0],
    recipeFat = selectedRecipe
      ? Math.max(2, Math.round((selectedRecipe.kcal * 0.25) / 9))
      : 0,
    recipeCarbs = selectedRecipe
      ? Math.max(
          0,
          Math.round(
            (selectedRecipe.kcal - selectedRecipe.protein * 4 - recipeFat * 9) /
              4,
          ),
        )
      : 0;
  const bmiProfile = calculateBmi(data);
  useEffect(() => {
    if (selectedRecipe)
      setServings(recommendedRecipeServing(data, selectedRecipe));
  }, [selectedRecipe?.name]);
  function celebrateFoodGoal(addedCalories) {
    if (
      selectedDate === today &&
      consumed < targets.calories &&
      consumed + Number(addedCalories) >= targets.calories
    ) {
      setFoodCelebrating(true);
      window.setTimeout(() => setFoodCelebrating(false), 3200);
    }
  }
  async function add(e) {
    e.preventDefault();
    if (entryMode === "recipe") {
      if (!selectedRecipe) return;
      const factor = Number(servings);
      const addedCalories = Math.round(selectedRecipe.kcal * factor);
      const { error } = await supabase.from("food_logs").insert({
        user_id: user.id,
        food_name: `Receita: ${selectedRecipe.name}`,
        grams: Math.round(factor * 100),
        calories: addedCalories,
        consumed_on: selectedDate,
        meal_type: selectedRecipe.type || mealType,
        protein_g: +(selectedRecipe.protein * factor).toFixed(1),
        carbs_g: +(recipeCarbs * factor).toFixed(1),
        fats_g: +(recipeFat * factor).toFixed(1),
      });
      if (!error) celebrateFoodGoal(addedCalories);
      load();
      return;
    }
    if (!selected) return;
    const nutrition = foodMacros(selected, grams);
    const addedCalories = Math.round((Number(grams) * selected[1]) / 100);
    const { error } = await supabase.from("food_logs").insert({
      user_id: user.id,
      food_name: selected[0],
      grams: +grams,
      calories: addedCalories,
      consumed_on: selectedDate,
      meal_type: mealType,
      protein_g: nutrition.protein,
      carbs_g: nutrition.carbs,
      fats_g: nutrition.fats,
    });
    if (!error) celebrateFoodGoal(addedCalories);
    load();
  }
  async function remove(id) {
    await supabase.from("food_logs").delete().eq("id", id);
    load();
  }
  return (
    <section className="nutritionPage">
      {foodCelebrating && <GoalCelebration type="food" />}
      <HydrationPanel data={data} user={user} />
      <div className="nutritionPersonalization">
        <span>PLANO PERSONALIZADO</span>
        <b>IMC {bmiProfile.value} • {bmiProfile.category}</b>
        <small>
          Meta calculada com sexo, idade, altura, peso, atividade e objetivo.
        </small>
        {targets.pace && (
          <small>
            {targets.pace.current} → {targets.pace.target} kg • ritmo calculado de{" "}
            {Math.abs(targets.pace.plannedWeekly)} kg/semana
            {targets.pace.status === "attention" && " • atenção: ritmo acima do ideal"}
          </small>
        )}
      </div>
      <div className="calorieBalance">
        <div>
          <span>META DO DIA</span>
          <b>{targets.calories} kcal</b>
        </div>
        <div>
          <span>CONSUMIDO</span>
          <b>{consumed} kcal</b>
        </div>
        <div className="remaining">
          <span>AINDA FALTAM</span>
          <b>{remaining} kcal</b>
        </div>
        <i>
          <em
            style={{
              width: `${Math.min(100, (consumed / targets.calories) * 100)}%`,
            }}
          />
        </i>
      </div>
      <div className="macroBalance">
        <div>
          <span>PROTEÍNA</span>
          <b>{Math.round(macros.protein)} g</b>
          <small>meta {targets.protein} g</small>
        </div>
        <div>
          <span>CARBOIDRATOS</span>
          <b>{Math.round(macros.carbs)} g</b>
          <small>meta {targets.carbs} g</small>
        </div>
        <div>
          <span>GORDURAS</span>
          <b>{Math.round(macros.fats)} g</b>
          <small>meta {targets.fat} g</small>
        </div>
      </div>
      {data.foodRestrictions && (
        <div className="foodAlert">
          <AlertTriangle />
          <div>
            <b>Filtro ativo: {data.foodRestrictions}</b>
            <span>
              Alimentos incompatíveis foram removidos. Para alergias graves,
              confira também ingredientes e rótulos.
            </span>
          </div>
        </div>
      )}
      <div className="nutritionTabs">
        <button
          className={view === "day" ? "active" : ""}
          onClick={() => setView("day")}
        >
          Meu dia
        </button>
        <button
          className={view === "recipes" ? "active" : ""}
          onClick={() => setView("recipes")}
        >
          Receitas
        </button>
        <button
          className={view === "history" ? "active" : ""}
          onClick={() => setView("history")}
        >
          Histórico
        </button>
      </div>
      {view === "day" ? (
        <div className="foodDiary">
          <form onSubmit={add}>
            <h2>Adicionar ao meu dia</h2>
            <div className="foodEntryMode">
              <button
                type="button"
                className={entryMode === "food" ? "active" : ""}
                onClick={() => setEntryMode("food")}
              >
                Alimento
              </button>
              <button
                type="button"
                className={entryMode === "recipe" ? "active" : ""}
                onClick={() => setEntryMode("recipe")}
              >
                Receita pronta
              </button>
            </div>
            <label>
              Dia
              <input
                type="date"
                max={today}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            {entryMode === "food" ? (
              <>
                <label>
                  Buscar alimento
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ex.: arroz, frango, banana"
                  />
                </label>
                <label>
                  Alimento
                  <select
                    value={selected?.[0] || ""}
                    onChange={(e) => setFood(e.target.value)}
                  >
                    {catalog.map((x) => (
                      <option key={x[0]}>{x[0]}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label>
                  Receita EVOQUEST
                  <select
                    value={selectedRecipe?.name || ""}
                    onChange={(event) => setRecipeName(event.target.value)}
                  >
                    {recommendedRecipes.map((recipe) => (
                      <option key={recipe.name} value={recipe.name}>
                        {recipe.name} — {recommendedRecipeServing(data, recipe)} porção(ões)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Porções consumidas
                  <select
                    value={servings}
                    onChange={(event) => setServings(event.target.value)}
                  >
                    <option value="0.5">½ porção</option>
                    <option value="1">1 porção</option>
                    <option value="1.5">1½ porção</option>
                    <option value="2">2 porções</option>
                  </select>
                </label>
                {selectedRecipe && (
                  <div className="selectedRecipePreview">
                    <span>{selectedRecipe.type} • {selectedRecipe.time} min</span>
                    <b>{Math.round(selectedRecipe.kcal * Number(servings))} kcal</b>
                    <small>
                      P {Math.round(selectedRecipe.protein * Number(servings))} g • C{" "}
                      {Math.round(recipeCarbs * Number(servings))} g • G{" "}
                      {Math.round(recipeFat * Number(servings))} g
                    </small>
                  </div>
                )}
              </>
            )}
            <label>
              Refeição
              <select
                value={mealType}
                onChange={(event) => setMealType(event.target.value)}
              >
                {[
                  "Café da manhã",
                  "Almoço",
                  "Lanche",
                  "Jantar",
                  "Refeição",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {entryMode === "food" && (
              <>
                <label>
                  Medida caseira
                  <select onChange={(event) => setGrams(event.target.value)} value={grams}>
                    <option value="30">1 colher (30 g)</option>
                    <option value="80">1 porção pequena (80 g)</option>
                    <option value="100">100 g</option>
                    <option value="150">1 porção média (150 g)</option>
                    <option value="200">1 porção grande (200 g)</option>
                  </select>
                </label>
                <label>
                  Quantidade (g)
                  <input type="number" min="1" max="3000" value={grams} onChange={(e) => setGrams(e.target.value)} />
                </label>
              </>
            )}
            <div>
              <b>
                {entryMode === "recipe"
                  ? `${Math.round((selectedRecipe?.kcal || 0) * Number(servings))} kcal`
                  : `${Math.round((Number(grams) * (selected?.[1] || 0)) / 100)} kcal`}
              </b>
              <button className="primary">
                {entryMode === "recipe" ? "Registrar receita" : "Adicionar alimento"}
              </button>
            </div>
          </form>
          <section>
            <h2>Consumido hoje</h2>
            {logs.length ? (
              logs.map((l) => (
                <article key={l.id}>
                  <span>
                    <b>{l.food_name}</b>
                    <small>
                      {l.meal_type || "Refeição"} •{" "}
                      {l.food_name?.startsWith("Receita:")
                        ? `${Number(l.grams) / 100} porção`
                        : `${l.grams} g`} • P{" "}
                      {l.protein_g || 0} g • C {l.carbs_g || 0} g • G{" "}
                      {l.fats_g || 0} g
                    </small>
                  </span>
                  <strong>{l.calories} kcal</strong>
                  <button onClick={() => remove(l.id)}>Excluir</button>
                </article>
              ))
            ) : (
              <p>Nenhum alimento registrado hoje.</p>
            )}
          </section>
        </div>
      ) : view === "recipes" ? (
        <section className="recipeLibrary">
          <header>
            <span>COZINHA EVOQUEST • BASE TACO</span>
            <h2>Receitas para {data.goal?.toLowerCase() || "seu objetivo"}</h2>
            <p>
              {recommendedRecipes.length} opções filtradas pela sua preferência.
              Valores aproximados; ingredientes e modo de preparo alteram a composição.
            </p>
          </header>
          <div className="recipeGrid">
            {recommendedRecipes.map((recipe) => (
              <details className="recipeCard" key={recipe.name}>
                <summary>
                  <span>{recipe.type}</span>
                  <h3>{recipe.name}</h3>
                  <div>
                    <b>{Math.round(recipe.kcal * recommendedRecipeServing(data, recipe))} kcal sugeridas</b>
                    <small>
                      {recommendedRecipeServing(data, recipe)} porção(ões) para seu perfil • {recipe.time} min
                    </small>
                  </div>
                </summary>
                <section>
                  <h4>Ingredientes</h4>
                  <ul>
                    {recipe.ingredients.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <h4>Como preparar</h4>
                  <ol>
                    {recipe.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  <button
                    className="primary recipeLogButton"
                    onClick={() => {
                      setRecipeName(recipe.name);
                      setEntryMode("recipe");
                      setMealType(recipe.type);
                      setServings(recommendedRecipeServing(data, recipe));
                      setView("day");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Registrar no meu dia
                  </button>
                </section>
              </details>
            ))}
          </div>
          <p className="nutritionSource">
            Referência nutricional: TACO/NEPA-Unicamp, 4ª edição. Sugestões
            educativas baseadas em comida de verdade; não são dieta terapêutica.
          </p>
        </section>
      ) : (
        <div className="nutritionHistory">
          <h2>Últimos 3 dias registrados</h2>
          {Object.entries(
            history.reduce((days, item) => {
              days[item.consumed_on] ||= { calories: 0, count: 0 };
              days[item.consumed_on].calories += Number(item.calories);
              days[item.consumed_on].count += 1;
              return days;
            }, {}),
          )
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .slice(0, 3)
            .map(([date, total]) => (
              <button
                key={date}
                onClick={() => {
                  setSelectedDate(date);
                  setView("day");
                }}
              >
                <CalendarDays />
                <span>
                  <b>{new Date(`${date}T12:00`).toLocaleDateString("pt-BR")}</b>
                  <small>{total.count} registros</small>
                </span>
                <strong>{Math.round(total.calories)} kcal</strong>
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

function WorkoutsSimple({ plan, user }) {
  return <WorkoutsCurrent plan={plan} user={user} />;
}

function WorkoutsCurrent({ plan, user }) {
  const [prefs, setPrefs] = useState({}),
    [draft, setDraft] = useState({}),
    [editing, setEditing] = useState(null),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [active, setActive] = useState(null),
    [history, setHistory] = useState([]),
    [logs, setLogs] = useState([]);
  async function load() {
    const [p, s, l] = await Promise.all([
      supabase.from("exercise_preferences").select("*").eq("user_id", user.id),
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(3),
      supabase
        .from("workout_exercise_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    const map = {};
    (p.data || []).forEach(
      (x) => (map[x.original_exercise] = x.replacement_exercise),
    );
    setPrefs(map);
    setHistory(s.data || []);
    setLogs(l.data || []);
    setReady(true);
  }
  useEffect(() => {
    load();
  }, []);
  const edited = plan.map((w) => ({
      ...w,
      items: w.items.map((item) => ({
        ...item,
        name: prefs[item.name] || item.name,
      })),
    })),
    lastByExercise = {};
  logs.forEach((l) => {
    if (!lastByExercise[l.exercise_name]) lastByExercise[l.exercise_name] = l;
  });
  function open(workout) {
    const next = {};
    workout.items.forEach(
      (item) => (next[item.name] = prefs[item.name] || item.name),
    );
    setDraft(next);
    setEditing(workout.id);
  }
  async function save(workout) {
    setSaving(true);
    const rows = workout.items.map((item) => ({
      user_id: user.id,
      original_exercise: item.name,
      replacement_exercise: (draft[item.name] || item.name)
        .trim()
        .slice(0, 100),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("exercise_preferences")
      .upsert(rows, { onConflict: "user_id,original_exercise" });
    if (!error) {
      setPrefs({ ...prefs, ...draft });
      setEditing(null);
    }
    setSaving(false);
  }
  if (!ready)
    return <div className="chartLoading">Carregando seus treinos...</div>;
  if (active)
    return (
      <WorkoutExecution
        workout={active}
        user={user}
        onClose={() => setActive(null)}
        onSaved={load}
        lastByExercise={lastByExercise}
      />
    );
  return (
    <section className="workoutPlan">
      <div className="workoutHero">
        <div>
          <span>PLANO PERSONALIZÁVEL</span>
          <h2>Treine do seu jeito</h2>
          <p>
            Escolha uma opção pronta ou digite o nome de qualquer exercício.
          </p>
        </div>
        <b>
          {plan.length}
          <small>treinos</small>
        </b>
      </div>
      <div className="workoutGrid">
        {plan.map((original, wi) => {
          const workout = edited[wi],
            isEditing = editing === original.id;
          return (
            <article
              className={`workoutCard simpleEditCard ${isEditing ? "editing" : ""}`}
              key={original.id}
            >
              <div className="workoutTitle">
                <span>{original.day}</span>
                <b>Treino {original.id}</b>
                <h2>{original.title}</h2>
              </div>
              {original.items.map((item, i) => (
                <div className="workoutItem" key={item.name}>
                  <i>{i + 1}</i>
                  <div>
                    <b>
                      {isEditing ? `Exercício ${i + 1}` : workout.items[i].name}
                    </b>
                    <small>{item.detail}</small>
                    {isEditing && (
                      <div className="exerciseChoice">
                        <input
                          list={`exercise-list-${original.id}-${i}`}
                          maxLength="100"
                          value={draft[item.name] || ""}
                          onChange={(e) =>
                            setDraft({ ...draft, [item.name]: e.target.value })
                          }
                          placeholder="Digite ou escolha um exercício"
                        />
                        <datalist id={`exercise-list-${original.id}-${i}`}>
                          {exercisePool.map((x) => (
                            <option value={x} key={x} />
                          ))}
                        </datalist>
                        <span>Digite livremente ou escolha uma sugestão.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isEditing ? (
                <div className="workoutEditActions">
                  <button onClick={() => setEditing(null)}>Cancelar</button>
                  <button
                    className="primary"
                    disabled={
                      saving ||
                      original.items.some((x) => !(draft[x.name] || "").trim())
                    }
                    onClick={() => save(original)}
                  >
                    {saving ? "Salvando..." : "Salvar treino"}
                  </button>
                </div>
              ) : (
                <div className="workoutCardActions">
                  <button
                    className="editOneWorkout"
                    onClick={() => open(original)}
                  >
                    Editar treino {original.id}
                  </button>
                  <button
                    className="primary"
                    onClick={() => setActive(workout)}
                  >
                    Iniciar treino <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="sessionHistory">
        <div className="historyTitle">
          <h2>Treinos recentes</h2>
          <span>{history.length} sessões</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((s) => (
            <article key={s.id}>
              <div>
                <b>
                  Treino {s.workout_code} — {s.workout_title}
                </b>
                <small>
                  {new Date(s.completed_at).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <span>
                {Math.round((s.completed_exercises / s.total_exercises) * 100)}%
                concluído
              </span>
            </article>
          ))
        ) : (
          <p className="emptyHistory">
            Seu histórico aparecerá após o primeiro treino.
          </p>
        )}
      </div>
    </section>
  );
}

function FirstVisitTip({ id, icon, title, children }) {
  const key = `evoquest-tip-${id}`,
    [open, setOpen] = useState(() => readEvoquestStorage(`tip-${id}`) !== "done");
  if (!open) return null;
  return (
    <div className="firstVisitTip">
      <span>{icon}</span>
      <div>
        <small>PRIMEIRO ACESSO</small>
        <h2>{title}</h2>
        {children}
      </div>
      <button
        onClick={() => {
          localStorage.setItem(key, "done");
          setOpen(false);
        }}
      >
        Entendi
      </button>
    </div>
  );
}

const expandedExercisePool = [
  ...new Set([
    ...exercisePool,
    "Hack squat",
    "Agachamento sumô",
    "Cadeira extensora",
    "Mesa flexora",
    "Cadeira abdutora",
    "Cadeira adutora",
    "Elevação pélvica",
    "Stiff com halteres",
    "Passada caminhando",
    "Step-up no banco",
    "Panturrilha sentada",
    "Supino com barra",
    "Supino inclinado com halteres",
    "Crucifixo com halteres",
    "Crossover na polia",
    "Peck deck",
    "Barra fixa assistida",
    "Puxada neutra",
    "Remada unilateral",
    "Remada cavalinho",
    "Pulldown unilateral",
    "Pullover na polia",
    "Desenvolvimento com halteres",
    "Arnold press",
    "Crucifixo inverso",
    "Encolhimento de ombros",
    "Rosca martelo",
    "Rosca alternada",
    "Rosca Scott",
    "Tríceps francês",
    "Tríceps testa",
    "Mergulho no banco",
    "Prancha lateral",
    "Abdominal infra",
    "Abdominal bicicleta",
    "Dead bug",
    "Bird dog",
    "Mountain climber",
    "Burpee",
    "Polichinelo",
    "Corrida estacionária",
  ]),
];
function poseKind(name) {
  const n = normalize(name);
  if (/agach|leg press|afundo|passada|step-up|extensora/.test(n)) return "legs";
  if (/supino|flexao|crucifixo|crossover|peck|triceps|mergulho/.test(n))
    return "chest";
  if (/remada|puxada|barra fixa|pulldown|pullover|rosca/.test(n)) return "back";
  if (/terra|romeno|stiff|ponte|pelvica|flexora/.test(n)) return "hinge";
  if (/desenvolvimento|elevacao|arnold|encolhimento/.test(n)) return "shoulder";
  return "core";
}
function PoseImage({ kind, end }) {
  return (
    <svg
      viewBox="0 0 180 150"
      role="img"
      aria-label={end ? "Posição final" : "Posição inicial"}
    >
      <rect width="180" height="150" rx="14" fill="#211330" />
      <path d="M20 128h140" stroke="#745886" strokeWidth="3" />
      <circle
        cx={kind === "core" ? 44 : 90}
        cy={kind === "core" ? 91 : 28}
        r="12"
        fill="#ffd1ad"
      />
      <g stroke="#ff8735" strokeWidth="9" strokeLinecap="round" fill="none">
        {kind === "legs" ? (
          <>
            <path d={end ? "M90 43L77 82" : "M90 43L90 82"} />
            <path
              d={
                end
                  ? "M77 82L52 104M77 82L108 103"
                  : "M90 82L70 124M90 82L111 124"
              }
            />
            <path
              d={
                end ? "M84 54L59 78M84 54L109 76" : "M88 54L67 80M92 54L114 79"
              }
            />
          </>
        ) : kind === "chest" ? (
          <>
            <path d="M45 80L112 80" />
            <path
              d={
                end ? "M67 80L83 55M88 80L104 55" : "M67 80L67 108M88 80L88 108"
              }
            />
            <path d="M112 80L143 112M112 80L146 91" />
          </>
        ) : kind === "back" ? (
          <>
            <path d="M90 42L90 85" />
            <path
              d={
                end ? "M88 54L58 55M92 54L122 55" : "M88 54L54 84M92 54L126 84"
              }
            />
            <path d="M90 85L69 124M90 85L111 124" />
          </>
        ) : kind === "hinge" ? (
          <>
            <path d={end ? "M90 43L90 84" : "M90 43L119 78"} />
            <path
              d={
                end
                  ? "M90 84L70 124M90 84L111 124"
                  : "M119 78L91 124M119 78L140 121"
              }
            />
            <path
              d={
                end
                  ? "M88 57L65 84M92 57L116 84"
                  : "M110 62L86 93M115 65L132 96"
              }
            />
          </>
        ) : kind === "shoulder" ? (
          <>
            <path d="M90 42L90 85" />
            <path
              d={
                end ? "M88 53L67 20M92 53L113 20" : "M88 53L60 72M92 53L120 72"
              }
            />
            <path d="M90 85L70 124M90 85L111 124" />
          </>
        ) : (
          <>
            <path d="M44 104L123 104" />
            <path d={end ? "M67 104L89 75" : "M67 104L67 72"} />
            <path d="M123 104L151 124M123 104L151 91" />
          </>
        )}
      </g>
      <text x="12" y="20" fill="#ff9b51" fontSize="11" fontWeight="700">
        {end ? "POSIÇÃO FINAL" : "POSIÇÃO INICIAL"}
      </text>
    </svg>
  );
}
const exerciseImages = [
  [["agachamento"], "agachamento"],
  [["afundo", "passada"], "afundo"],
  [["elevação pélvica", "ponte de glúteos"], "elevacao-pelvica"],
  [["flexão de braços", "flexão inclinada"], "flexao"],
  [["bird dog"], "bird-dog"],
  [["prancha lateral"], "prancha-lateral"],
  [["prancha"], "prancha"],
  [["leg press"], "leg-press"],
  [["hack squat"], "hack-squat"],
  [["stiff", "terra romeno", "levantamento romeno"], "stiff-halteres"],
  [["cadeira extensora"], "cadeira-extensora"],
  [["mesa flexora", "cadeira flexora"], "mesa-flexora"],
  [["panturrilha"], "panturrilha"],
  [["supino inclinado"], "supino-inclinado"],
  [["supino com barra"], "supino-barra"],
  [["supino com halteres", "supino reto"], "supino-halteres"],
  [["crucifixo com halteres"], "crucifixo-halteres"],
  [["crossover"], "crossover"],
  [["tríceps na polia"], "triceps-polia"],
  [["puxada frontal", "puxada neutra"], "puxada-frontal"],
  [["remada sentada", "remada baixa"], "remada-sentada"],
  [["remada unilateral"], "remada-unilateral"],
  [["barra fixa"], "barra-fixa"],
  [["rosca martelo"], "rosca-martelo"],
  [["rosca direta", "rosca com halteres"], "rosca-direta"],
  [["desenvolvimento", "arnold press"], "desenvolvimento"],
  [["elevação lateral"], "elevacao-lateral"],
  [["crucifixo inverso", "face pull"], "crucifixo-inverso"],
  [["dead bug"], "dead-bug"],
  [["abdominal bicicleta"], "abdominal-bicicleta"],
];
function imageForExercise(name) {
  const n = normalize(name),
    match = exerciseImages.find(([terms]) =>
      terms.some((t) => n.includes(normalize(t))),
    );
  return match ? `${import.meta.env.BASE_URL}exercises/${match[1]}.webp` : null;
}
function exerciseCategory(name) {
  const kind = poseKind(name);
  return kind === "legs" || kind === "hinge"
    ? "Pernas"
    : kind === "chest"
      ? "Peito e tríceps"
      : kind === "back"
        ? "Costas e bíceps"
        : kind === "shoulder"
          ? "Ombros"
          : "Core e cardio";
}
function ExerciseGuidePhotos({ name }) {
  const g = exerciseGuide(name),
    image = imageForExercise(name);
  return (
    <details className="exerciseGuide photoGuide">
      <summary>
        <span className="playIcon">▣</span> Como fazer
      </summary>
      <div>
        {image ? (
          <img
            className="exercisePhoto"
            src={image}
            alt={`Posições inicial e final de ${name}`}
            loading="lazy"
          />
        ) : (
          <div className="photoPending">
            <span>▣</span>
            <b>Imagem em preparação</b>
            <small>
              Este exercício personalizado ainda não possui uma demonstração
              verificada.
            </small>
          </div>
        )}
        <p className="imageNote">
          Posição inicial e final • observe postura, amplitude e controle.
        </p>
        <span>MÚSCULOS TRABALHADOS</span>
        <b>{g.muscles}</b>
        <ol>
          {g.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p>
          <strong>Evite:</strong> {g.mistake}
        </p>
        <p>
          <strong>Alternativa:</strong> {g.swap}
        </p>
        <em>
          As imagens são educativas e não substituem correção presencial de
          técnica.
        </em>
      </div>
    </details>
  );
}

function WorkoutsFlexible({ plan, user }) {
  const [custom, setCustom] = useState(null),
    [editing, setEditing] = useState(null),
    [draft, setDraft] = useState([]),
    [saving, setSaving] = useState(false),
    [active, setActive] = useState(null),
    [history, setHistory] = useState([]),
    [logs, setLogs] = useState([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos"),
    [message, setMessage] = useState("");
  async function load() {
    const [c, s, l] = await Promise.all([
      supabase
        .from("custom_workouts")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(3),
      supabase
        .from("workout_exercise_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setCustom(c.data?.plan || plan);
    setHistory(s.data || []);
    setLogs(l.data || []);
  }
  useEffect(() => {
    load();
  }, []);
  const lastByExercise = {};
  logs.forEach((l) => {
    if (!lastByExercise[l.exercise_name]) lastByExercise[l.exercise_name] = l;
  });
  function open(w) {
    setDraft(w.items.map((x) => ({ ...x })));
    setEditing(w.id);
  }
  function update(i, name) {
    setDraft(draft.map((x, n) => (n === i ? { ...x, name } : x)));
  }
  function updateExercise(i, field, value) {
    setDraft(
      draft.map((exercise, index) =>
        index === i ? { ...exercise, [field]: value } : exercise,
      ),
    );
  }
  function add() {
    setDraft([
      ...draft,
      {
        name: "",
        weight: "",
        detail: "3 séries × 10–12 • descanso 60–90 s",
      },
    ]);
  }
  function remove(i) {
    setDraft(draft.filter((_, n) => n !== i));
  }
  async function save(id) {
    setSaving(true);
    const next = custom.map((w) =>
      w.id === id
        ? { ...w, items: draft.map((x) => ({ ...x, name: x.name.trim() })) }
        : w,
    );
    const { error } = await supabase
      .from("custom_workouts")
      .upsert(
        { user_id: user.id, plan: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (!error) {
      setCustom(next);
      setEditing(null);
    }
    setSaving(false);
  }
  async function persist(next, success) {
    setSaving(true);
    const { error } = await supabase
      .from("custom_workouts")
      .upsert(
        { user_id: user.id, plan: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) setMessage("Não foi possível atualizar a prancheta.");
    else {
      setCustom(next);
      setMessage(success);
    }
  }
  function createWorkout() {
    const id = String.fromCharCode(65 + custom.length);
    persist(
      [
        ...custom,
        {
          id,
          title: `Treino ${id}`,
          day: `Dia ${custom.length + 1}`,
          items: [
            {
              name: "Agachamento livre",
              weight: "",
              detail: "3 séries × 10–12 • descanso 60–90 s",
            },
          ],
        },
      ],
      "Novo treino criado.",
    );
  }
  function duplicateWorkout(workout) {
    const id = String.fromCharCode(65 + custom.length);
    persist(
      [
        ...custom,
        {
          ...workout,
          id,
          title: `${workout.title} — cópia`,
          day: `Dia ${custom.length + 1}`,
          items: workout.items.map((item) => ({ ...item })),
        },
      ],
      "Treino duplicado.",
    );
  }
  function deleteWorkout(id) {
    if (
      custom.length === 1 ||
      !window.confirm("Excluir este treino da prancheta?")
    )
      return;
    persist(
      custom.filter((workout) => workout.id !== id),
      "Treino excluído.",
    );
  }
  const filteredExercises = expandedExercisePool.filter(
    (name) =>
      (!query || normalize(name).includes(normalize(query))) &&
      (category === "Todos" || exerciseCategory(name) === category),
  );
  if (!custom)
    return <div className="chartLoading">Carregando seus treinos...</div>;
  if (active)
    return (
      <WorkoutExecution
        workout={active}
        user={user}
        onClose={() => setActive(null)}
        onSaved={load}
        lastByExercise={lastByExercise}
      />
    );
  return (
    <section className="workoutPlan">
      <FirstVisitTip
        id={`workouts-${user.id}`}
        icon="🏋️"
        title="Seu treino é totalmente flexível"
      >
        <p>
          A EVOQUEST sugere um ponto de partida. Você pode trocar nomes, remover
          exercícios ou adicionar quantos quiser. Para qualidade e recuperação,
          comece com 4–8 exercícios por sessão.
        </p>
      </FirstVisitTip>
      <div className="workoutHero">
        <div>
          <span>PLANO SEM LIMITE FIXO</span>
          <h2>Monte cada sessão</h2>
          <p>Adicione, remova ou escreva qualquer exercício.</p>
        </div>
        <b>
          {custom.reduce((s, w) => s + w.items.length, 0)}
          <small>exercícios</small>
        </b>
      </div>
      <div className="workoutLibraryBar searchFilterBar">
        <label className="searchControl">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar exercício"
          />
        </label>
        <select
          className="filterControl"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {[
            "Todos",
            "Pernas",
            "Peito e tríceps",
            "Costas e bíceps",
            "Ombros",
            "Core e cardio",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button onClick={createWorkout}>
          <Plus /> Novo treino
        </button>
      </div>
      {query && (
        <div className="exerciseSearchResults">
          {filteredExercises.slice(0, 12).map((name) => (
            <button
              key={name}
              onClick={() => {
                if (editing)
                  setDraft([
                    ...draft,
                    {
                      name,
                      weight: "",
                      detail: "3 séries × 10–12 • descanso 60–90 s",
                    },
                  ]);
              }}
            >
              {name}
              <small>{exerciseCategory(name)}</small>
            </button>
          ))}
        </div>
      )}
      {message && <div className="coachMessage">{message}</div>}
      <div className="workoutGrid">
        {custom.map((workout) => {
          const isEditing = editing === workout.id;
          return (
            <article
              className={`workoutCard simpleEditCard ${isEditing ? "editing" : ""}`}
              key={workout.id}
            >
              <div className="workoutTitle">
                <span>{workout.day}</span>
                <b>Treino {workout.id}</b>
                <h2>{workout.title}</h2>
              </div>
              {(isEditing ? draft : workout.items).map((item, i) => (
                <div className="workoutItem flexibleItem" key={i}>
                  <i>{i + 1}</i>
                  <div>
                    {isEditing ? (
                      <div className="exerciseEditFields">
                        <input
                          className="exerciseNameInput"
                          list="full-exercise-list"
                          value={item.name}
                          onChange={(e) => update(i, e.target.value)}
                          placeholder="Digite o exercício"
                        />
                        <datalist id="full-exercise-list">
                          {expandedExercisePool.map((x) => (
                            <option value={x} key={x} />
                          ))}
                        </datalist>
                        <label>
                          <span>Carga inicial</span>
                          <input
                            className="exerciseWeightInput"
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.weight || ""}
                            onChange={(event) =>
                              updateExercise(i, "weight", event.target.value)
                            }
                            placeholder="kg"
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <b>{item.name}</b>
                        <small>{item.detail}</small>
                        {item.weight !== "" && item.weight != null && (
                          <small className="exerciseDefaultWeight">
                            Carga inicial: {item.weight} kg
                          </small>
                        )}
                      </>
                    )}
                  </div>
                  {isEditing && (
                    <div className="exerciseOrderActions">
                      <button
                        className="removeExercise"
                        onClick={() => remove(i)}
                        disabled={draft.length === 1}
                        aria-label={`Excluir ${item.name || "exercício"}`}
                      >
                        <Trash2 />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isEditing ? (
                <>
                  <button className="addExercise" onClick={add}>
                    + Adicionar exercício
                  </button>
                  <div className="workoutEditActions">
                    <button onClick={() => setEditing(null)}>Cancelar</button>
                    <button
                      className="primary"
                      disabled={saving || draft.some((x) => !x.name.trim())}
                      onClick={() => save(workout.id)}
                    >
                      {saving ? "Salvando..." : "Salvar treino"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="workoutUtilityActions">
                    <button onClick={() => duplicateWorkout(workout)}>
                      <Copy /> Duplicar
                    </button>
                    <button
                      disabled={custom.length === 1}
                      onClick={() => deleteWorkout(workout.id)}
                    >
                      <Trash2 /> Excluir
                    </button>
                  </div>
                  <div className="workoutCardActions">
                    <button
                      className="editOneWorkout"
                      onClick={() => open(workout)}
                    >
                      Editar treino {workout.id}
                    </button>
                    <button
                      className="primary"
                      onClick={() => setActive(workout)}
                    >
                      Iniciar treino <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="sessionHistory">
        <div className="historyTitle">
          <h2>Treinos recentes</h2>
          <span>{history.length} sessões</span>
        </div>
        {history.length ? (
          history.slice(0, 3).map((s) => (
            <article key={s.id}>
              <div>
                <b>
                  Treino {s.workout_code} — {s.workout_title}
                </b>
                <small>
                  {new Date(s.completed_at).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <span>
                {Math.round((s.completed_exercises / s.total_exercises) * 100)}%
                concluído
              </span>
            </article>
          ))
        ) : (
          <p className="emptyHistory">
            Seu histórico aparecerá após o primeiro treino.
          </p>
        )}
      </div>
    </section>
  );
}

const circumferenceFields = [
  ["neck_cm", "Pescoço"],
  ["shoulders_cm", "Ombros"],
  ["chest_cm", "Tórax/peitoral"],
  ["waist_cm", "Cintura"],
  ["abdomen_cm", "Abdômen"],
  ["hips_cm", "Quadril"],
  ["arm_right_relaxed_cm", "Braço direito relaxado"],
  ["arm_left_relaxed_cm", "Braço esquerdo relaxado"],
  ["arm_right_flexed_cm", "Braço direito contraído"],
  ["arm_left_flexed_cm", "Braço esquerdo contraído"],
  ["forearm_right_cm", "Antebraço direito"],
  ["forearm_left_cm", "Antebraço esquerdo"],
  ["thigh_right_cm", "Coxa direita"],
  ["thigh_left_cm", "Coxa esquerda"],
  ["calf_right_cm", "Panturrilha direita"],
  ["calf_left_cm", "Panturrilha esquerda"],
];
const skinfoldFields = [
  ["skinfold_chest_mm", "Peitoral"],
  ["skinfold_midaxillary_mm", "Axilar média"],
  ["skinfold_triceps_mm", "Tricipital"],
  ["skinfold_subscapular_mm", "Subescapular"],
  ["skinfold_abdominal_mm", "Abdominal"],
  ["skinfold_suprailiac_mm", "Supra-ilíaca"],
  ["skinfold_thigh_mm", "Coxa"],
  ["skinfold_biceps_mm", "Bicipital"],
  ["skinfold_calf_mm", "Panturrilha"],
];
function MeasurementInputs({ fields, form, setForm, unit }) {
  return (
    <div className="measurementGrid">
      {fields.map(([key, label]) => (
        <label key={key}>
          {label} ({unit})
          <input
            type="number"
            min="0"
            max={unit === "cm" ? 400 : 100}
            step="0.1"
            value={form[key] || ""}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder="—"
          />
        </label>
      ))}
    </div>
  );
}
function ProgressFull({ user, data }) {
  const photoInputRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10),
    empty = { weight: data.weight || "", date: today, notes: "" };
  const [records, setRecords] = useState([]),
    [form, setForm] = useState(empty),
    [section, setSection] = useState("basic"),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [goals, setGoals] = useState({
      target_weight_kg: "",
      target_date: "",
    }),
    [photos, setPhotos] = useState([]),
    [photoFile, setPhotoFile] = useState(null),
    [photoLabel, setPhotoLabel] = useState("Frente"),
    [photoSaving, setPhotoSaving] = useState(false),
    [photoMessage, setPhotoMessage] = useState(""),
    [photoPreview, setPhotoPreview] = useState(""),
    [galleryOpen, setGalleryOpen] = useState(false),
    [deletingPhotoId, setDeletingPhotoId] = useState(null);
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);
  async function load() {
    setLoading(true);
    const [recordsResult, goalsResult, photosResult] = await Promise.all([
      supabase
        .from("progress_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("body_goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("progress_photos")
        .select("*")
        .eq("user_id", user.id)
        .order("taken_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setRecords(recordsResult.data || []);
    setGoals(
      goalsResult.data || {
        target_weight_kg: "",
        target_date: "",
      },
    );
    setPhotos(photosResult.data || []);
    if (recordsResult.error)
      setMessage("Não foi possível carregar as avaliações.");
    if (photosResult.error)
      setPhotoMessage(
        `Não foi possível carregar sua galeria: ${photosResult.error.message}`,
      );
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const row = {
      user_id: user.id,
      weight_kg: +form.weight,
      recorded_at: form.date,
      notes: form.notes || "",
    };
    [...circumferenceFields, ...skinfoldFields].forEach(
      ([key]) => (row[key] = form[key] ? +form[key] : null),
    );
    const { error } = await supabase.from("progress_records").insert(row);
    setSaving(false);
    if (error)
      return setMessage(
        "Não foi possível salvar. Confirme se a migração 008 foi executada.",
      );
    setForm({ ...empty, date: today });
    setMessage("Avaliação corporal registrada.");
    load();
  }
  async function remove(id) {
    if (window.confirm("Excluir esta avaliação?")) {
      await supabase.from("progress_records").delete().eq("id", id);
      load();
    }
  }
  async function saveGoals(event) {
    event.preventDefault();
    if (goalAnalysis.status === "blocked") {
      setMessage("Ajuste o prazo antes de salvar esta meta.");
      return;
    }
    const { error } = await supabase.from("body_goals").upsert(
      {
        user_id: user.id,
        target_weight_kg: goals.target_weight_kg
          ? +goals.target_weight_kg
          : null,
        target_date: goals.target_date || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setMessage(
      error ? "Não foi possível salvar as metas." : "Metas atualizadas.",
    );
  }
  async function uploadProgressPhoto(event) {
    event.preventDefault();
    if (!photoFile || photoSaving) return;
    if (photoFile.size > 5 * 1024 * 1024) {
      setPhotoMessage("A foto deve ter no máximo 5 MB.");
      return;
    }
    setPhotoSaving(true);
    setPhotoMessage("Enviando foto...");
    const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}-${photoLabel.toLowerCase()}.${extension}`;
    const upload = await supabase.storage
      .from("progress-photos")
      .upload(path, photoFile, { contentType: photoFile.type });
    if (upload.error) {
      setPhotoMessage(`Falha no envio da imagem: ${upload.error.message}`);
      setPhotoSaving(false);
      return;
    }
    const url = supabase.storage.from("progress-photos").getPublicUrl(path).data
      .publicUrl;
    const { data: savedPhoto, error: insertError } = await supabase
      .from("progress_photos")
      .insert({
        user_id: user.id,
        photo_url: url,
        storage_path: path,
        pose: photoLabel,
        taken_on: today,
      })
      .select("*")
      .single();
    if (insertError) {
      await supabase.storage.from("progress-photos").remove([path]);
      setPhotoMessage(
        `A imagem foi enviada, mas não pôde ser salva na galeria: ${insertError.message}`,
      );
      setPhotoSaving(false);
      return;
    }
    setPhotos((current) => [savedPhoto, ...current]);
    setPhotoPreview("");
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    setPhotoMessage("Foto salva! Ela já está disponível na sua galeria.");
    setPhotoSaving(false);
  }
  async function deleteProgressPhoto(photo) {
    if (
      deletingPhotoId ||
      !window.confirm("Excluir esta foto de evolução permanentemente?")
    )
      return;
    setDeletingPhotoId(photo.id);
    setPhotoMessage("");
    const { error } = await supabase
      .from("progress_photos")
      .delete()
      .eq("id", photo.id)
      .eq("user_id", user.id);
    if (error) {
      setPhotoMessage(`Não foi possível excluir a foto: ${error.message}`);
      setDeletingPhotoId(null);
      return;
    }
    if (photo.storage_path) {
      const storageResult = await supabase.storage
        .from("progress-photos")
        .remove([photo.storage_path]);
      if (storageResult.error)
        setPhotoMessage(
          "A foto saiu da galeria, mas o arquivo não pôde ser removido do armazenamento.",
        );
      else setPhotoMessage("Foto excluída da galeria.");
    } else setPhotoMessage("Foto excluída da galeria.");
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    setDeletingPhotoId(null);
  }
  const first = records[0],
    last = records.at(-1),
    weightChange =
      first && last ? (+last.weight_kg - +first.weight_kg).toFixed(1) : null;
  const currentGoalWeight = Number(last?.weight_kg || data.weight || form.weight),
    goalPreviewData = {
      ...data,
      weight: currentGoalWeight,
      targetWeight: goals.target_weight_kg,
      targetDate: goals.target_date,
    },
    goalAnalysis = evaluateWeightGoal(goalPreviewData),
    goalNutrition = calculateNutritionTargets(goalPreviewData);
  const measured = last
    ? circumferenceFields.filter(([k]) => last[k] != null).length
    : 0;
  return (
    <section className="progressPage fullAssessment">
      <FirstVisitTip
        id={`measurements-${user.id}`}
        icon="📏"
        title="Avaliação corporal completa"
      >
        <p>
          Peso e data são obrigatórios; todas as circunferências e dobras são
          opcionais. Meça sempre no mesmo horário e ponto anatômico. Dobras
          cutâneas devem ser coletadas por um profissional treinado.
        </p>
      </FirstVisitTip>
      <div className="assessmentStats">
        <article>
          <small>ÚLTIMO PESO</small>
          <b>{last ? `${last.weight_kg} kg` : "—"}</b>
          <span>
            {weightChange === null
              ? "Sem comparação"
              : `${+weightChange > 0 ? "+" : ""}${weightChange} kg desde o início`}
          </span>
        </article>
        <article>
          <small>ÚLTIMA AVALIAÇÃO</small>
          <b>
            {last
              ? new Date(`${last.recorded_at}T12:00`).toLocaleDateString("pt-BR")
              : "—"}
          </b>
          <span>{last ? "registro mais recente" : "Sem avaliação"}</span>
        </article>
        <article>
          <small>MEDIDAS PREENCHIDAS</small>
          <b>
            {measured}/{circumferenceFields.length}
          </b>
          <span>na última avaliação</span>
        </article>
      </div>
      <form className="bodyGoals" onSubmit={saveGoals}>
        <div>
          <span>METAS CORPORAIS</span>
          <h2>Próximo objetivo</h2>
        </div>
        <label>
          Peso alvo (kg)
          <input
            type="number"
            step=".1"
            value={goals.target_weight_kg || ""}
            onChange={(event) =>
              setGoals({ ...goals, target_weight_kg: event.target.value })
            }
          />
        </label>
        <label>
          Data alvo
          <input
            type="date"
            min={today}
            value={goals.target_date || ""}
            onChange={(event) =>
              setGoals({ ...goals, target_date: event.target.value })
            }
          />
        </label>
        {goalAnalysis.status !== "incomplete" && (
          <div className={`goalSafety ${goalAnalysis.status}`}>
            <b>
              {goalAnalysis.status === "recommended"
                ? "Prazo recomendado"
                : goalAnalysis.status === "attention"
                  ? "Prazo possível, acima do ritmo ideal"
                  : "Meta não segura neste prazo"}
            </b>
            {goalAnalysis.status === "blocked" ? (
              <>
                <span>{goalAnalysis.reason || `Esse ritmo exigiria cerca de ${goalAnalysis.requestedPercent}% do peso por semana.`}</span>
                {goalAnalysis.suggestedDate && (
                  <button
                    type="button"
                    onClick={() =>
                      setGoals({ ...goals, target_date: goalAnalysis.suggestedDate })
                    }
                  >
                    Usar prazo sugerido: {new Date(`${goalAnalysis.suggestedDate}T12:00`).toLocaleDateString("pt-BR")}
                  </button>
                )}
              </>
            ) : (
              <>
                <span>
                  Ritmo: {Math.abs(goalAnalysis.requestedWeekly)} kg/semana • usando {currentGoalWeight} kg e {data.height} cm.
                </span>
                <strong>
                  {goalNutrition.calories} kcal • P {goalNutrition.protein} g • C {goalNutrition.carbs} g • G {goalNutrition.fat} g
                </strong>
                {goalAnalysis.status === "attention" && (
                  <small>Você pode aceitar este prazo. A composição do ganho dependerá do treino, sono e resposta individual.</small>
                )}
              </>
            )}
          </div>
        )}
        <button className="primary" disabled={goalAnalysis.status === "blocked"}>
          Aceitar e atualizar metas
        </button>
      </form>
      <form className="progressForm assessmentForm" onSubmit={save}>
        <div className="assessmentHead">
          <div>
            <span>NOVA AVALIAÇÃO</span>
            <h2>Registre suas medidas</h2>
          </div>
          <div className="assessmentTabs">
            <button
              type="button"
              className={section === "basic" ? "active" : ""}
              onClick={() => setSection("basic")}
            >
              Essencial
            </button>
            <button
              type="button"
              className={section === "circumference" ? "active" : ""}
              onClick={() => setSection("circumference")}
            >
              Circunferências
            </button>
            <button
              type="button"
              className={section === "skinfolds" ? "active" : ""}
              onClick={() => setSection("skinfolds")}
            >
              Dobras cutâneas
            </button>
          </div>
        </div>
        {section === "basic" && (
          <>
            <div className="measurementGrid basic">
              <label>
                Peso (kg)
                <input
                  required
                  type="number"
                  min="30"
                  max="500"
                  step=".1"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </label>
              <label>
                Data
                <input
                  required
                  type="date"
                  max={today}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                maxLength="1000"
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Condições da medição, horário, treino, alimentação..."
              />
            </label>
          </>
        )}
        {section === "circumference" && (
          <>
            <div className="measurementHelp">
              Use fita métrica sem apertar a pele. Registre os lados
              separadamente para acompanhar assimetrias.
            </div>
            <MeasurementInputs
              fields={circumferenceFields}
              form={form}
              setForm={setForm}
              unit="cm"
            />
          </>
        )}
        {section === "skinfolds" && (
          <>
            <div className="measurementWarning">
              <AlertTriangle /> Coleta opcional com adipômetro. Não calcule
              percentual de gordura sem protocolo, sexo, idade e técnica
              padronizada.
            </div>
            <MeasurementInputs
              fields={skinfoldFields}
              form={form}
              setForm={setForm}
              unit="mm"
            />
          </>
        )}
        {message && <div className="progressMessage">{message}</div>}
        <button className="primary assessmentSave" disabled={saving}>
          {saving ? "Salvando..." : "Salvar avaliação completa"}
        </button>
      </form>
      <div className="chartCard">
        <div>
          <span>EVOLUÇÃO DO PESO</span>
          <h2>Sua trajetória</h2>
        </div>
        {loading ? (
          <div className="chartLoading">Carregando...</div>
        ) : (
          <ProgressChart records={records} />
        )}
      </div>
      <div className="assessmentCompare">
        <header>
          <div>
            <span>COMPARAÇÃO</span>
            <h2>Primeira × última avaliação</h2>
          </div>
          <button onClick={() => window.print()}>Imprimir / salvar PDF</button>
        </header>
        <div>
          {[
            ["Peso", first?.weight_kg, last?.weight_kg, "kg"],
            ["Cintura", first?.waist_cm, last?.waist_cm, "cm"],
            ["Tórax", first?.chest_cm, last?.chest_cm, "cm"],
            ["Quadril", first?.hips_cm, last?.hips_cm, "cm"],
          ].map(([label, before, after, unit]) => (
            <article key={label}>
              <span>{label}</span>
              <b>
                {before || "—"} {before && unit}
              </b>
              <ArrowRight />
              <b>
                {after || "—"} {after && unit}
              </b>
              <small>
                {before && after
                  ? `${+after - +before > 0 ? "+" : ""}${(+after - +before).toFixed(1)} ${unit}`
                  : "Sem comparação"}
              </small>
            </article>
          ))}
        </div>
      </div>
      <div className="progressPhotos">
        <header>
          <div>
            <span>FOTOS DE EVOLUÇÃO</span>
            <h2>Adicionar nova foto</h2>
            <p>A imagem só será adicionada à galeria depois de ser salva.</p>
          </div>
        </header>
        <form onSubmit={uploadProgressPhoto}>
          <select
            value={photoLabel}
            onChange={(event) => setPhotoLabel(event.target.value)}
          >
            <option>Frente</option>
            <option>Lado</option>
            <option>Costas</option>
          </select>
          <input
            ref={photoInputRef}
            required
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              setPhotoMessage("");
              setPhotoFile(event.target.files?.[0] || null);
            }}
          />
          <button className="primary" disabled={photoSaving || !photoFile}>
            {photoSaving ? "Salvando..." : "Salvar na galeria"}
          </button>
        </form>
        {photoPreview && photoFile && (
          <div className="progressPhotoPreview">
            <img src={photoPreview} alt="Prévia da foto selecionada" />
            <div>
              <span>PRÉVIA</span>
              <b>{photoFile?.name}</b>
              <small>
                {photoLabel} • {Math.max(1, Math.round(photoFile?.size / 1024))} KB
              </small>
            </div>
          </div>
        )}
        {photoMessage && (
          <div className="progressPhotoMessage" role="status">
            {photoMessage}
          </div>
        )}
      </div>
      <section className="progressPhotoGallery">
        <header>
          <div>
            <span>GALERIA DE PROGRESSO</span>
            <h2>{photos.length} {photos.length === 1 ? "foto salva" : "fotos salvas"}</h2>
          </div>
          <button
            type="button"
            className="galleryToggle"
            onClick={() => setGalleryOpen((open) => !open)}
            aria-expanded={galleryOpen}
          >
            {galleryOpen ? "Ocultar galeria" : "Ver fotos salvas"}
          </button>
        </header>
        {galleryOpen && (!loading && photos.length === 0 ? (
          <div className="emptyPhotoGallery">
            <Camera />
            <b>Nenhuma foto salva ainda</b>
            <span>Escolha uma imagem acima para iniciar sua evolução visual.</span>
          </div>
        ) : (
          <div className="progressPhotoGrid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <a href={photo.photo_url} target="_blank" rel="noreferrer">
                <img
                  src={photo.photo_url}
                  alt={`${photo.pose} em ${photo.taken_on}`}
                  loading="lazy"
                />
              </a>
              <figcaption>
                <span>
                  <b>{photo.pose}</b>
                  <small>{new Date(`${photo.taken_on}T12:00`).toLocaleDateString("pt-BR")}</small>
                </span>
                <button
                  type="button"
                  onClick={() => deleteProgressPhoto(photo)}
                  disabled={deletingPhotoId === photo.id}
                  aria-label={`Excluir foto ${photo.pose}`}
                >
                  <Trash2 />
                  {deletingPhotoId === photo.id ? "Excluindo..." : "Excluir"}
                </button>
              </figcaption>
            </figure>
          ))}
          </div>
        ))}
      </section>
      <div className="historyCard">
        <div className="historyTitle">
          <h2>Histórico de avaliações</h2>
          <span>{Math.min(records.length, 3)} recentes</span>
        </div>
        {!records.length && !loading ? (
          <p className="emptyHistory">Sua primeira avaliação aparecerá aqui.</p>
        ) : (
          [...records]
            .reverse()
            .slice(0, 3)
            .map((r) => (
              <details className="assessmentHistory" key={r.id}>
                <summary>
                  <div>
                    <b>
                      {new Date(r.recorded_at + "T12:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </b>
                    <small>
                      {r.weight_kg} kg •{" "}
                      {circumferenceFields.filter(([k]) => r[k] != null).length}{" "}
                      medidas
                    </small>
                  </div>
                  <span>Ver detalhes</span>
                </summary>
                <div className="historyMeasurements">
                  {circumferenceFields
                    .filter(([k]) => r[k] != null)
                    .map(([k, label]) => (
                      <p key={k}>
                        <span>{label}</span>
                        <b>{r[k]} cm</b>
                      </p>
                    ))}
                </div>
                <footer>
                  <p>{r.notes || "Sem observações"}</p>
                  <button onClick={() => remove(r.id)}>
                    Excluir avaliação
                  </button>
                </footer>
              </details>
            ))
        )}
      </div>
    </section>
  );
}

function StudentCoachLink() {
  const [code, setCode] = useState(""),
    [trainer, setTrainer] = useState(null),
    [message, setMessage] = useState("");
  async function load() {
    const { data } = await supabase.rpc("get_my_trainer");
    setTrainer(data?.[0] || null);
  }
  useEffect(() => {
    load();
  }, []);
  async function connect(e) {
    e.preventDefault();
    setMessage("");
    const { data, error } = await supabase.rpc("accept_trainer_invite", {
      invite_code_input: code.trim().toUpperCase(),
    });
    if (error || !data) return setMessage(error?.message || "Código inválido.");
    setMessage("Vínculo criado com sucesso.");
    setCode("");
    load();
  }
  async function disconnect() {
    if (!window.confirm("Encerrar o vínculo com este personal?")) return;
    await supabase
      .from("trainer_student_links")
      .delete()
      .eq("trainer_id", trainer.trainer_id);
    setTrainer(null);
  }
  return (
    <section className="coachLinkPage">
      {trainer ? (
        <div className="connectedCoach">
          <span>PERSONAL VINCULADO</span>
          <h2>{trainer.full_name}</h2>
          <p>
            {trainer.specialty || "Acompanhamento profissional"} •{" "}
            {trainer.cref || "CREF não informado"}
          </p>
          <div>
            <small>
              Desde {new Date(trainer.connected_at).toLocaleDateString("pt-BR")}
            </small>
            <button onClick={disconnect}>Encerrar vínculo</button>
          </div>
        </div>
      ) : (
        <form onSubmit={connect}>
          <span>CONVITE PROFISSIONAL</span>
          <h2>Conecte-se ao seu personal</h2>
          <p>
            Digite o código fornecido pelo profissional. Você poderá revogar o
            acesso quando quiser.
          </p>
          <label>
            Código de convite
            <input
              required
              maxLength="12"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex.: EVOQUEST-A1B2"
            />
          </label>
          <button className="primary">Aceitar convite</button>
        </form>
      )}
      {message && <div className="coachMessage">{message}</div>}
      <div className="consentNote">
        <b>O que o personal poderá acessar?</b>
        <p>
          Avaliação física, medidas, check-ins, histórico de treinos e seu
          plano. Dados de login e senha nunca são compartilhados.
        </p>
      </div>
    </section>
  );
}

function TrainerPortal({ user, logout, soundEnabled, toggleSound }) {
  const [profile, setProfile] = useState(null),
    [students, setStudents] = useState([]),
    [selected, setSelected] = useState(null),
    [editingProfile, setEditingProfile] = useState(false);
  async function load() {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("app_profiles").select("*").eq("user_id", user.id).single(),
      supabase.rpc("trainer_get_students"),
    ]);
    setProfile(p);
    setStudents(s || []);
  }
  useEffect(() => {
    load();
  }, []);
  if (!profile)
    return (
      <div className="appLoading">
        <Logo /> Carregando painel profissional...
      </div>
    );
  return (
    <div className="trainerShell theme-arcade">
      <aside>
        <Logo />
        <div className="trainerIdentity">
          <span>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              profile.full_name?.slice(0, 2).toUpperCase()
            )}
          </span>
          <b>{profile.full_name}</b>
          <small>Conta profissional</small>
        </div>
        <button className="current" onClick={() => setSelected(null)}>
          Meus alunos
        </button>
        <button onClick={() => setEditingProfile(true)}>
          Perfil profissional
        </button>
        <button onClick={logout}>Sair</button>
      </aside>
      <main className="trainerMain">
        <header>
          <div>
            <span>CO-OP CONTROL CENTER • ÁREA DO PERSONAL</span>
            <h1>{selected ? selected.full_name : "Gestão de alunos"}</h1>
          </div>
          <div className="inviteCode">
            <small>SEU CÓDIGO</small>
            <b>{profile.invite_code}</b>
            <button
              onClick={() =>
                navigator.clipboard?.writeText(profile.invite_code)
              }
            >
              Copiar
            </button>
          </div>
          <EvoquestSpriteScene scene="header" action="coach" />
          <SettingsMenu enabled={soundEnabled} toggle={toggleSound} />
        </header>
        {editingProfile ? (
          <TrainerProfile
            profile={profile}
            close={() => {
              setEditingProfile(false);
              load();
            }}
          />
        ) : selected ? (
          <TrainerStudentV4 student={selected} back={() => setSelected(null)} />
        ) : (
          <TrainerStudents students={students} select={setSelected} />
        )}
      </main>
    </div>
  );
}
function TrainerProfile({ profile, close }) {
  const [form, setForm] = useState({
      full_name: profile.full_name || "",
      cref: profile.cref || "",
      specialty: profile.specialty || "",
      bio: profile.bio || "",
    }),
    [saving, setSaving] = useState(false),
    [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(profile.avatar_url || ""),
    [message, setMessage] = useState("");
  function choosePhoto(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (
      !selected.type.startsWith("image/") ||
      selected.size > 3 * 1024 * 1024
    ) {
      setMessage("Use uma imagem JPG, PNG ou WebP de até 3 MB.");
      return;
    }
    setPhoto(selected);
    setPreview(URL.createObjectURL(selected));
    setMessage("");
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    let avatarUrl = profile.avatar_url || "";
    if (photo) {
      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.user_id}/profile.${extension}`;
      const upload = await supabase.storage
        .from("profile-photos")
        .upload(path, photo, { upsert: true, contentType: photo.type });
      if (upload.error) {
        setSaving(false);
        setMessage(
          "Não foi possível enviar a foto. Execute a atualização SQL 014.",
        );
        return;
      }
      avatarUrl = `${supabase.storage.from("profile-photos").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    }
    const result = await supabase
      .from("app_profiles")
      .update({
        ...form,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (result.error) setMessage("Não foi possível salvar o perfil.");
    else close();
  }
  return (
    <form className="trainerProfileForm" onSubmit={save}>
      <span>PERFIL PROFISSIONAL</span>
      <h2>Suas informações</h2>
      <div className="profilePhotoEditor">
        <label className="photoPreview">
          {preview ? (
            <img src={preview} alt="Foto profissional" />
          ) : (
            <UserRound />
          )}
          <i>
            <Camera />
          </i>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={choosePhoto}
          />
        </label>
        <div>
          <b>Foto profissional</b>
          <small>JPG, PNG ou WebP • máximo de 3 MB</small>
        </div>
      </div>
      <div className="fieldGrid">
        <label>
          Nome completo
          <input
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </label>
        <label>
          CREF
          <input
            value={form.cref}
            onChange={(e) => setForm({ ...form, cref: e.target.value })}
            placeholder="Ex.: 000000-G/SP"
          />
        </label>
        <label>
          Especialidade
          <input
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            placeholder="Ex.: Hipertrofia e emagrecimento"
          />
        </label>
      </div>
      <label>
        Apresentação
        <textarea
          maxLength="1000"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </label>
      <div>
        <button type="button" onClick={close}>
          Cancelar
        </button>
        {message && <div className="profileSaveMessage">{message}</div>}
        <button className="primary" disabled={saving}>
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
function TrainerStudents({ students, select }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const visible = students.filter(
    (student) =>
      (!query || normalize(student.full_name).includes(normalize(query))) &&
      (filter === "all" ||
        (filter === "alerts"
          ? student.pain_reported
          : Number(student.week_sessions) === 0)),
  );
  return (
    <section className="trainerStudents">
      <div className="trainerStats">
        <article>
          <small>ALUNOS ATIVOS</small>
          <b>{students.length}</b>
        </article>
        <article>
          <small>TREINOS NA SEMANA</small>
          <b>{students.reduce((s, x) => s + (x.week_sessions || 0), 0)}</b>
        </article>
        <article>
          <small>ALERTAS</small>
          <b>{students.filter((x) => x.pain_reported).length}</b>
        </article>
      </div>
      <div className="studentList">
        <h2>Seus alunos</h2>
        <div className="studentFilters searchFilterBar">
          <label className="searchControl">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar aluno"
            />
          </label>
          <select
            className="filterControl"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="alerts">Com alerta</option>
            <option value="inactive">Sem treino na semana</option>
          </select>
        </div>
        {visible.length ? (
          visible.map((s) => (
            <button key={s.student_id} onClick={() => select(s)}>
              <span className="studentPhoto">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt={`Foto de ${s.full_name}`} />
                ) : (
                  s.full_name?.slice(0, 2).toUpperCase()
                )}
              </span>
              <div>
                <b>{s.full_name}</b>
                <small>
                  {s.goal || "Avaliação pendente"} • {s.week_sessions || 0}{" "}
                  treinos na semana
                </small>
              </div>
              {s.pain_reported && <em>Dor informada</em>}
              <ArrowRight />
            </button>
          ))
        ) : (
          <div className="emptyStudents">
            <UserRound />
            <b>Nenhum aluno vinculado</b>
            <p>
              {students.length ? (
                "Nenhum aluno corresponde aos filtros."
              ) : (
                <>
                  Compartilhe o código acima. O aluno deve aceitar em{" "}
                  <strong>Personal</strong> dentro da conta dele.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
function TrainerStudent({ student, back }) {
  const [detail, setDetail] = useState(null),
    [draft, setDraft] = useState([]),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const { data, error } = await supabase.rpc("trainer_get_student_detail", {
      student_input: student.student_id,
    });
    if (!error) {
      const d = Array.isArray(data) ? data[0] : data;
      setDetail(d);
      setDraft(d?.plan || []);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function updateName(wi, ii, value) {
    setDraft(
      draft.map((w, a) =>
        a === wi
          ? {
              ...w,
              items: w.items.map((x, b) =>
                b === ii ? { ...x, name: value } : x,
              ),
            }
          : w,
      ),
    );
  }
  function add(wi) {
    setDraft(
      draft.map((w, a) =>
        a === wi
          ? {
              ...w,
              items: [
                ...w.items,
                { name: "", detail: "3 séries × 10–12 • descanso 60–90 s" },
              ],
            }
          : w,
      ),
    );
  }
  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("trainer_save_student_plan", {
      student_input: student.student_id,
      plan_input: draft,
    });
    setSaving(false);
    setMessage(
      error ? "Não foi possível salvar." : "Treino atualizado para o aluno.",
    );
  }
  if (!detail) return <div className="chartLoading">Carregando ficha...</div>;
  return (
    <section className="trainerStudent">
      <button className="backStudent" onClick={back}>
        <ChevronLeft /> Voltar aos alunos
      </button>
      <div className="studentOverview">
        <article>
          <small>OBJETIVO</small>
          <b>{detail.assessment?.goal || "—"}</b>
        </article>
        <article>
          <small>PESO ATUAL</small>
          <b>
            {detail.latest_progress?.weight_kg
              ? `${detail.latest_progress.weight_kg} kg`
              : "—"}
          </b>
        </article>
        <article>
          <small>ÚLTIMO CHECK-IN</small>
          <b>
            {detail.latest_checkin?.week_start
              ? new Date(
                  detail.latest_checkin.week_start + "T12:00",
                ).toLocaleDateString("pt-BR")
              : "—"}
          </b>
        </article>
        <article>
          <small>SESSÕES</small>
          <b>{detail.session_count || 0}</b>
        </article>
      </div>
      {detail.assessment?.restrictions && (
        <div className="measurementWarning">
          <AlertTriangle /> Limitações: {detail.assessment.restrictions}
        </div>
      )}
      <div className="studentMeasures">
        <h2>Últimas medidas</h2>
        <div>
          {[
            ["weight_kg", "Peso", "kg"],
            ["waist_cm", "Cintura", "cm"],
            ["chest_cm", "Tórax", "cm"],
            ["hips_cm", "Quadril", "cm"],
            ["arm_right_flexed_cm", "Braço D.", "cm"],
            ["thigh_right_cm", "Coxa D.", "cm"],
          ].map(([k, l, u]) => (
            <p key={k}>
              <span>{l}</span>
              <b>
                {detail.latest_progress?.[k]
                  ? `${detail.latest_progress[k]} ${u}`
                  : "—"}
              </b>
            </p>
          ))}
        </div>
      </div>
      <div className="trainerWorkoutEditor">
        <div>
          <span>PLANO DO ALUNO</span>
          <h2>Editor profissional</h2>
        </div>
        {draft.map((w, wi) => (
          <article key={w.id}>
            <header>
              <b>
                Treino {w.id} — {w.title}
              </b>
              <button onClick={() => add(wi)}>+ Exercício</button>
            </header>
            {w.items.map((x, ii) => (
              <div key={ii}>
                <input
                  value={x.name}
                  onChange={(e) => updateName(wi, ii, e.target.value)}
                  placeholder="Nome do exercício"
                />
                <input
                  value={x.detail}
                  onChange={(e) =>
                    setDraft(
                      draft.map((a, n) =>
                        n === wi
                          ? {
                              ...a,
                              items: a.items.map((b, m) =>
                                m === ii ? { ...b, detail: e.target.value } : b,
                              ),
                            }
                          : a,
                      ),
                    )
                  }
                  placeholder="Séries, repetições e descanso"
                />
                <button
                  onClick={() =>
                    setDraft(
                      draft.map((a, n) =>
                        n === wi
                          ? { ...a, items: a.items.filter((_, m) => m !== ii) }
                          : a,
                      ),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            ))}
          </article>
        ))}
        {message && <div className="coachMessage">{message}</div>}
        <button
          className="primary saveStudentPlan"
          disabled={
            saving ||
            draft.some(
              (w) => !w.items.length || w.items.some((x) => !x.name.trim()),
            )
          }
          onClick={save}
        >
          {saving ? "Salvando..." : "Salvar treino do aluno"}
        </button>
      </div>
    </section>
  );
}

function TrainerStudentV2({ student, back }) {
  const [detail, setDetail] = useState(null),
    [draft, setDraft] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase.rpc(
      "trainer_get_student_detail_v2",
      { p_student_id: student.student_id },
    );
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const starter = [
        {
          id: "A",
          title: "Treino A",
          day: "Dia 1",
          items: [
            {
              name: "Agachamento livre",
              detail: "3 séries × 10–12 • descanso 60–90 s",
            },
          ],
        },
        {
          id: "B",
          title: "Treino B",
          day: "Dia 2",
          items: [
            {
              name: "Supino com halteres",
              detail: "3 séries × 10–12 • descanso 60–90 s",
            },
          ],
        },
        {
          id: "C",
          title: "Treino C",
          day: "Dia 3",
          items: [
            {
              name: "Remada sentada",
              detail: "3 séries × 10–12 • descanso 60–90 s",
            },
          ],
        },
      ],
      d = Array.isArray(data) ? data[0] : data;
    setDetail(d || {});
    setDraft(d?.plan?.length ? d.plan : starter);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [student.student_id]);
  function change(wi, ii, key, value) {
    setDraft(
      draft.map((w, a) =>
        a === wi
          ? {
              ...w,
              items: w.items.map((x, b) =>
                b === ii ? { ...x, [key]: value } : x,
              ),
            }
          : w,
      ),
    );
  }
  function add(wi) {
    setDraft(
      draft.map((w, a) =>
        a === wi
          ? {
              ...w,
              items: [
                ...w.items,
                { name: "", detail: "3 séries × 10–12 • descanso 60–90 s" },
              ],
            }
          : w,
      ),
    );
  }
  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("trainer_save_student_plan", {
      student_input: student.student_id,
      plan_input: draft,
    });
    setSaving(false);
    setMessage(error ? error.message : "Treino atualizado para o aluno.");
  }
  if (loading)
    return (
      <div className="studentLoadState">
        <div className="loadSpinner" />
        <b>Carregando ficha...</b>
        <small>Isso normalmente leva poucos segundos.</small>
      </div>
    );
  if (loadError)
    return (
      <div className="studentLoadError">
        <AlertTriangle />
        <h2>Não foi possível abrir a ficha</h2>
        <p>{loadError}</p>
        <div>
          <button onClick={back}>Voltar</button>
          <button className="primary" onClick={load}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  return (
    <section className="trainerStudent">
      <button className="backStudent" onClick={back}>
        <ChevronLeft /> Voltar aos alunos
      </button>
      <div className="studentOverview">
        <article>
          <small>OBJETIVO</small>
          <b>{detail.assessment?.goal || "—"}</b>
        </article>
        <article>
          <small>PESO ATUAL</small>
          <b>
            {detail.latest_progress?.weight_kg
              ? `${detail.latest_progress.weight_kg} kg`
              : "—"}
          </b>
        </article>
        <article>
          <small>ÚLTIMO CHECK-IN</small>
          <b>
            {detail.latest_checkin?.week_start
              ? new Date(
                  detail.latest_checkin.week_start + "T12:00",
                ).toLocaleDateString("pt-BR")
              : "—"}
          </b>
        </article>
        <article>
          <small>SESSÕES</small>
          <b>{detail.session_count || 0}</b>
        </article>
      </div>
      {detail.assessment?.restrictions && (
        <div className="measurementWarning">
          <AlertTriangle /> Limitações: {detail.assessment.restrictions}
        </div>
      )}
      <div className="studentMeasures">
        <h2>Últimas medidas</h2>
        <div>
          {[
            ["weight_kg", "Peso", "kg"],
            ["waist_cm", "Cintura", "cm"],
            ["chest_cm", "Tórax", "cm"],
            ["hips_cm", "Quadril", "cm"],
            ["arm_right_flexed_cm", "Braço D.", "cm"],
            ["thigh_right_cm", "Coxa D.", "cm"],
          ].map(([k, l, u]) => (
            <p key={k}>
              <span>{l}</span>
              <b>
                {detail.latest_progress?.[k]
                  ? `${detail.latest_progress[k]} ${u}`
                  : "—"}
              </b>
            </p>
          ))}
        </div>
      </div>
      <div className="trainerWorkoutEditor">
        <div>
          <span>PLANO DO ALUNO</span>
          <h2>Editor profissional</h2>
        </div>
        {draft.map((w, wi) => (
          <article key={w.id}>
            <header>
              <b>
                Treino {w.id} — {w.title}
              </b>
              <button onClick={() => add(wi)}>+ Exercício</button>
            </header>
            {w.items.map((x, ii) => (
              <div key={ii}>
                <input
                  value={x.name}
                  onChange={(e) => change(wi, ii, "name", e.target.value)}
                  placeholder="Nome do exercício"
                />
                <input
                  value={x.detail}
                  onChange={(e) => change(wi, ii, "detail", e.target.value)}
                  placeholder="Séries, repetições e descanso"
                />
                <button
                  onClick={() =>
                    setDraft(
                      draft.map((a, n) =>
                        n === wi
                          ? { ...a, items: a.items.filter((_, m) => m !== ii) }
                          : a,
                      ),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            ))}
          </article>
        ))}
        {message && <div className="coachMessage">{message}</div>}
        <button
          className="primary saveStudentPlan"
          disabled={
            saving ||
            draft.some(
              (w) => !w.items.length || w.items.some((x) => !x.name.trim()),
            )
          }
          onClick={save}
        >
          {saving ? "Salvando..." : "Salvar treino do aluno"}
        </button>
      </div>
    </section>
  );
}

function TrainerStudentV3({ student, back }) {
  const today = new Date().toISOString().slice(0, 10),
    starter = [
      {
        id: "A",
        title: "Treino A",
        day: "Dia 1",
        items: [
          {
            name: "Agachamento livre",
            detail: "3 séries × 10–12 • descanso 60–90 s",
          },
        ],
      },
    ];
  const [tab, setTab] = useState("summary"),
    [workspace, setWorkspace] = useState(null),
    [plan, setPlan] = useState([]),
    [assessment, setAssessment] = useState({}),
    [measure, setMeasure] = useState({
      recorded_at: today,
      weight_kg: "",
      notes: "",
    }),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [templates, setTemplates] = useState([]),
    [templateName, setTemplateName] = useState(""),
    [trainerExerciseQuery, setTrainerExerciseQuery] = useState(""),
    [trainerExerciseCategory, setTrainerExerciseCategory] = useState("Todos"),
    [trainerTargetWorkout, setTrainerTargetWorkout] = useState(0);
  async function load() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase.rpc(
      "trainer_get_student_workspace_v3",
      { p_student_id: student.student_id },
    );
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setWorkspace(data || {});
    setPlan(data?.plan?.length ? data.plan : starter);
    setAssessment(data?.assessment || {});
    setMeasure((m) => ({
      ...m,
      weight_kg:
        data?.latest_progress?.weight_kg || data?.assessment?.weight_kg || "",
    }));
    const { data: savedTemplates } = await supabase
      .from("workout_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates(savedTemplates || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [student.student_id]);
  async function call(name, args, ok) {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.rpc(name, args);
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(ok);
    await load();
  }
  function changeExercise(wi, ii, key, value) {
    setPlan(
      plan.map((w, a) =>
        a === wi
          ? {
              ...w,
              items: w.items.map((x, b) =>
                b === ii ? { ...x, [key]: value } : x,
              ),
            }
          : w,
      ),
    );
  }
  function addWorkout() {
    const id = String.fromCharCode(65 + plan.length);
    setPlan([
      ...plan,
      {
        id,
        title: `Treino ${id}`,
        day: `Dia ${plan.length + 1}`,
        items: [{ name: "", detail: "3 séries × 10–12 • descanso 60–90 s" }],
      },
    ]);
    setTrainerTargetWorkout(plan.length);
  }
  function addCatalogExercise(name) {
    setPlan(
      plan.map((workout, index) =>
        index === Number(trainerTargetWorkout)
          ? {
              ...workout,
              items: [
                ...workout.items,
                {
                  name,
                  weight: "",
                  detail: "3 séries × 10–12 • descanso 60–90 s",
                },
              ],
            }
          : workout,
      ),
    );
    setMessage(
      `${name} adicionado ao ${plan[trainerTargetWorkout]?.title || "treino"}.`,
    );
  }
  async function saveTemplate() {
    if (!templateName.trim()) return setMessage("Dê um nome ao modelo.");
    const currentUser = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("workout_templates").insert({
      trainer_id: currentUser.id,
      name: templateName.trim(),
      plan,
    });
    setTemplateName("");
    setMessage(
      error
        ? "Não foi possível salvar o modelo."
        : "Modelo salvo para outros alunos.",
    );
    load();
  }
  const tabs = [
    ["summary", "Resumo"],
    ["workouts", "Prancheta de treino"],
    ["assessment", "Avaliação"],
    ["measurements", "Nova medição"],
    ["history", "Histórico"],
  ];
  const trainerExerciseOptions = expandedExercisePool.filter(
    (name) =>
      (!trainerExerciseQuery ||
        normalize(name).includes(normalize(trainerExerciseQuery))) &&
      (trainerExerciseCategory === "Todos" ||
        exerciseCategory(name) === trainerExerciseCategory),
  );
  if (loading)
    return (
      <div className="studentLoadState">
        <div className="loadSpinner" />
        <b>Carregando prontuário...</b>
        <small>Treinos, medidas e histórico em um só lugar.</small>
      </div>
    );
  if (error)
    return (
      <div className="studentLoadError">
        <AlertTriangle />
        <h2>Não foi possível abrir o prontuário</h2>
        <p>{error}</p>
        <div>
          <button onClick={back}>Voltar</button>
          <button className="primary" onClick={load}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  const latest = workspace.latest_progress || {};
  return (
    <section className="trainerStudent trainerWorkspace">
      <button className="backStudent" onClick={back}>
        <ChevronLeft /> Voltar aos alunos
      </button>
      <div className="workspaceNotice">
        Tudo que for salvo aqui usa a mesma ficha exibida no aplicativo do
        aluno.
      </div>
      <nav className="workspaceTabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <div className="coachMessage workspaceMessage">{message}</div>
      )}
      {tab === "summary" && (
        <>
          <div className="studentOverview">
            <article>
              <small>OBJETIVO</small>
              <b>{assessment.goal || "—"}</b>
            </article>
            <article>
              <small>PESO ATUAL</small>
              <b>{latest.weight_kg ? `${latest.weight_kg} kg` : "—"}</b>
            </article>
            <article>
              <small>AVALIAÇÕES</small>
              <b>{workspace.progress_history?.length || 0}</b>
            </article>
            <article>
              <small>SESSÕES</small>
              <b>{workspace.sessions?.length || 0}</b>
            </article>
          </div>
          {assessment.restrictions && (
            <div className="measurementWarning">
              <AlertTriangle /> Limitações: {assessment.restrictions}
            </div>
          )}
          <div className="studentMeasures">
            <h2>Últimas medidas</h2>
            <div>
              {[
                ["weight_kg", "Peso", "kg"],
                ["waist_cm", "Cintura", "cm"],
                ["chest_cm", "Tórax", "cm"],
                ["hips_cm", "Quadril", "cm"],
                ["arm_right_flexed_cm", "Braço D.", "cm"],
                ["thigh_right_cm", "Coxa D.", "cm"],
              ].map(([k, l, u]) => (
                <p key={k}>
                  <span>{l}</span>
                  <b>{latest[k] ? `${latest[k]} ${u}` : "—"}</b>
                </p>
              ))}
            </div>
          </div>
        </>
      )}
      {tab === "workouts" && (
        <div className="trainerWorkoutEditor workspacePanel">
          <div className="panelHeading">
            <div>
              <span>PLANO SINCRONIZADO</span>
              <h2>Prancheta de treino</h2>
            </div>
            <button onClick={addWorkout}>+ Novo treino</button>
          </div>
          <div className="templateBar trainerTemplateBar">
            <label>
              Aplicar modelo
              <select
                defaultValue=""
                onChange={(event) => {
                  const template = templates.find(
                    (item) => String(item.id) === event.target.value,
                  );
                  if (template) setPlan(template.plan);
                }}
              >
                <option value="">Escolha um modelo</option>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Salvar como modelo
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Ex.: Hipertrofia 3x"
              />
            </label>
            <button onClick={saveTemplate}>
              <Star /> Salvar modelo
            </button>
          </div>
          <div className="trainerExerciseLibrary">
            <div className="trainerLibraryHeading">
              <div>
                <span>BIBLIOTECA DE EXERCÍCIOS</span>
                <h3>Escolha e adicione ao treino</h3>
              </div>
              <small>
                Você também pode digitar um nome personalizado abaixo.
              </small>
            </div>
            <div className="trainerLibraryControls searchFilterBar">
              <select
                value={trainerTargetWorkout}
                onChange={(event) =>
                  setTrainerTargetWorkout(Number(event.target.value))
                }
                aria-label="Treino que receberá o exercício"
              >
                {plan.map((workout, index) => (
                  <option value={index} key={`${workout.id}-${index}`}>
                    Adicionar em: {workout.title || `Treino ${workout.id}`}
                  </option>
                ))}
              </select>
              <label className="searchControl">
                <Search />
                <input
                  value={trainerExerciseQuery}
                  onChange={(event) =>
                    setTrainerExerciseQuery(event.target.value)
                  }
                  placeholder="Buscar exercício"
                />
              </label>
              <select
                className="filterControl"
                value={trainerExerciseCategory}
                onChange={(event) =>
                  setTrainerExerciseCategory(event.target.value)
                }
                aria-label="Filtrar exercícios por grupo"
              >
                {[
                  "Todos",
                  "Pernas",
                  "Peito e tríceps",
                  "Costas e bíceps",
                  "Ombros",
                  "Core e cardio",
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="trainerExerciseResults">
              {trainerExerciseOptions.slice(0, 12).map((name) => (
                <button key={name} onClick={() => addCatalogExercise(name)}>
                  <Plus />
                  <span>
                    <b>{name}</b>
                    <small>{exerciseCategory(name)}</small>
                  </span>
                </button>
              ))}
              {!trainerExerciseOptions.length && (
                <p>
                  Nenhum exercício encontrado. Digite o nome diretamente na
                  ficha.
                </p>
              )}
            </div>
          </div>
          {plan.map((w, wi) => (
            <article key={`${w.id}-${wi}`}>
              <header>
                <div className="workoutMeta">
                  <input
                    value={w.title || ""}
                    onChange={(e) =>
                      setPlan(
                        plan.map((x, n) =>
                          n === wi ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Nome do treino"
                  />
                  <input
                    value={w.day || ""}
                    onChange={(e) =>
                      setPlan(
                        plan.map((x, n) =>
                          n === wi ? { ...x, day: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Dia"
                  />
                </div>
                <div>
                  <button
                    onClick={() =>
                      setPlan(
                        plan.map((x, n) =>
                          n === wi
                            ? {
                                ...x,
                                items: [
                                  ...x.items,
                                  {
                                    name: "",
                                    weight: "",
                                    detail:
                                      "3 séries × 10–12 • descanso 60–90 s",
                                  },
                                ],
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    + Exercício
                  </button>
                  {plan.length > 1 && (
                    <button
                      className="dangerLight"
                      onClick={() => setPlan(plan.filter((_, n) => n !== wi))}
                    >
                      Excluir treino
                    </button>
                  )}
                </div>
              </header>
              {w.items.map((x, ii) => (
                <div key={ii}>
                  <input
                    list="trainer-full-exercise-list"
                    value={x.name}
                    onChange={(e) =>
                      changeExercise(wi, ii, "name", e.target.value)
                    }
                    placeholder="Nome do exercício"
                  />
                  <datalist id="trainer-full-exercise-list">
                    {expandedExercisePool.map((exercise) => (
                      <option value={exercise} key={exercise} />
                    ))}
                  </datalist>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={x.weight || ""}
                    onChange={(e) =>
                      changeExercise(wi, ii, "weight", e.target.value)
                    }
                    placeholder="Carga inicial (kg)"
                  />
                  <input
                    value={x.detail}
                    onChange={(e) =>
                      changeExercise(wi, ii, "detail", e.target.value)
                    }
                    placeholder="Séries, repetições e descanso"
                  />
                  <button
                    onClick={() =>
                      setPlan(
                        plan.map((a, n) =>
                          n === wi
                            ? {
                                ...a,
                                items: a.items.filter((_, m) => m !== ii),
                              }
                            : a,
                        ),
                      )
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
            </article>
          ))}
          <button
            className="primary saveStudentPlan"
            disabled={
              saving ||
              plan.some(
                (w) => !w.items.length || w.items.some((x) => !x.name?.trim()),
              )
            }
            onClick={() =>
              call(
                "trainer_save_student_plan_v3",
                { p_student_id: student.student_id, p_plan: plan },
                "Treino salvo e disponibilizado para o aluno.",
              )
            }
          >
            {saving ? "Salvando..." : "Salvar prancheta do aluno"}
          </button>
        </div>
      )}
      {tab === "assessment" && (
        <form
          className="workspacePanel assessmentEditor"
          onSubmit={(e) => {
            e.preventDefault();
            call(
              "trainer_update_student_assessment",
              { p_student_id: student.student_id, p_data: assessment },
              "Avaliação atualizada para o aluno.",
            );
          }}
        >
          <div className="panelHeading">
            <div>
              <span>PERFIL E METAS</span>
              <h2>Avaliação do aluno</h2>
            </div>
          </div>
          <div className="assessmentEditGrid">
            <label>
              Objetivo
              <input
                value={assessment.goal || ""}
                onChange={(e) =>
                  setAssessment({ ...assessment, goal: e.target.value })
                }
              />
            </label>
            <label>
              Local de treino
              <input
                value={assessment.training_place || ""}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    training_place: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Dias por semana
              <input
                type="number"
                min="1"
                max="7"
                value={assessment.training_days || ""}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    training_days: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Nível
              <input
                value={assessment.experience_level || ""}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    experience_level: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Idade
              <input
                type="number"
                value={assessment.age || ""}
                onChange={(e) =>
                  setAssessment({ ...assessment, age: e.target.value })
                }
              />
            </label>
            <label>
              Altura (cm)
              <input
                type="number"
                step=".1"
                value={assessment.height_cm || ""}
                onChange={(e) =>
                  setAssessment({ ...assessment, height_cm: e.target.value })
                }
              />
            </label>
            <label>
              Peso de referência (kg)
              <input
                type="number"
                step=".1"
                value={assessment.weight_kg || ""}
                onChange={(e) =>
                  setAssessment({ ...assessment, weight_kg: e.target.value })
                }
              />
            </label>
            <label>
              Nível de atividade
              <input
                value={assessment.activity_level || ""}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    activity_level: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <label>
            Restrições físicas
            <textarea
              value={assessment.restrictions || ""}
              onChange={(e) =>
                setAssessment({ ...assessment, restrictions: e.target.value })
              }
            />
          </label>
          <label>
            Equipamentos disponíveis
            <textarea
              value={assessment.equipment || ""}
              onChange={(e) =>
                setAssessment({ ...assessment, equipment: e.target.value })
              }
            />
          </label>
          <button className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar avaliação do aluno"}
          </button>
        </form>
      )}
      {tab === "measurements" && (
        <form
          className="workspacePanel assessmentEditor"
          onSubmit={(e) => {
            e.preventDefault();
            call(
              "trainer_add_student_measurement",
              { p_student_id: student.student_id, p_data: measure },
              "Medição adicionada ao histórico do aluno.",
            );
          }}
        >
          <div className="panelHeading">
            <div>
              <span>AVALIAÇÃO FÍSICA</span>
              <h2>Registrar novas medidas</h2>
            </div>
          </div>
          <div className="measurementGrid basic">
            <label>
              Peso (kg)
              <input
                required
                type="number"
                step=".1"
                min="30"
                value={measure.weight_kg || ""}
                onChange={(e) =>
                  setMeasure({ ...measure, weight_kg: e.target.value })
                }
              />
            </label>
            <label>
              Data
              <input
                required
                type="date"
                max={today}
                value={measure.recorded_at}
                onChange={(e) =>
                  setMeasure({ ...measure, recorded_at: e.target.value })
                }
              />
            </label>
          </div>
          <h3>Circunferências</h3>
          <MeasurementInputs
            fields={circumferenceFields}
            form={measure}
            setForm={setMeasure}
            unit="cm"
          />
          <h3>Dobras cutâneas</h3>
          <MeasurementInputs
            fields={skinfoldFields}
            form={measure}
            setForm={setMeasure}
            unit="mm"
          />
          <label>
            Observações
            <textarea
              value={measure.notes || ""}
              onChange={(e) =>
                setMeasure({ ...measure, notes: e.target.value })
              }
            />
          </label>
          <button className="primary" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar ao histórico do aluno"}
          </button>
        </form>
      )}
      {tab === "history" && (
        <div className="workspaceHistory">
          <section>
            <h2>Avaliações corporais</h2>
            {workspace.progress_history?.slice(0, 3).map((r) => (
              <article key={r.id}>
                <div>
                  <b>
                    {new Date(r.recorded_at + "T12:00").toLocaleDateString(
                      "pt-BR",
                    )}
                  </b>
                  <small>{r.notes || "Sem observações"}</small>
                </div>
                <strong>{r.weight_kg} kg</strong>
              </article>
            )) || null}
          </section>
          <section>
            <h2>Treinos concluídos</h2>
            {workspace.sessions?.slice(0, 3).map((r, i) => (
              <article key={r.id || i}>
                <div>
                  <b>{r.workout_title || r.workout_id || "Treino"}</b>
                  <small>
                    {r.completed_at
                      ? new Date(r.completed_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </small>
                </div>
              </article>
            )) || null}
          </section>
          <section>
            <h2>Alterações do personal</h2>
            {workspace.changes?.slice(0, 3).map((r) => (
              <article key={r.id}>
                <div>
                  <b>{r.summary}</b>
                  <small>
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </small>
                </div>
              </article>
            )) || null}
          </section>
        </div>
      )}
    </section>
  );
}

function TrainerStudentV4({ student, back }) {
  const [workspace, setWorkspace] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [manage, setManage] = useState(false);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "trainer_get_student_workspace_v4",
      { p_student_id: student.student_id },
    );
    setError(error?.message || "");
    setWorkspace(data || null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [student.student_id]);
  if (manage)
    return (
      <div>
        <button
          className="backStudent"
          onClick={() => {
            setManage(false);
            load();
          }}
        >
          <ChevronLeft /> Voltar ao painel completo
        </button>
        <TrainerStudentV3 student={student} back={back} />
      </div>
    );
  if (loading)
    return (
      <div className="studentLoadState">
        <div className="loadSpinner" />
        <b>Montando painel completo...</b>
        <small>Analisando treinos, medidas, cargas e recuperação.</small>
      </div>
    );
  if (error)
    return (
      <div className="studentLoadError">
        <AlertTriangle />
        <h2>Execute a migração 012</h2>
        <p>{error}</p>
        <div>
          <button onClick={back}>Voltar</button>
          <button className="primary" onClick={load}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  const a = workspace.assessment || {},
    latest = workspace.latest_progress || {},
    bodyGoals = workspace.body_goals || {},
    progressPhotos = workspace.progress_photos || [],
    progress = workspace.progress_history || [],
    sessions = workspace.sessions || [],
    checks = workspace.checkins || [],
    logs = workspace.exercise_logs || [],
    now = Date.now(),
    weekSessions = sessions.filter(
      (s) => now - new Date(s.completed_at).getTime() < 7 * 86400000,
    ),
    lastCheck = checks[0],
    first = progress.at(-1) || {},
    weightDelta =
      latest.weight_kg && first.weight_kg
        ? (+latest.weight_kg - +first.weight_kg).toFixed(1)
        : null,
    completion = sessions.length
      ? Math.round(
          (sessions.reduce(
            (s, x) =>
              s +
              (x.total_exercises
                ? x.completed_exercises / x.total_exercises
                : 0),
            0,
          ) /
            sessions.length) *
            100,
        )
      : 0,
    alerts = [];
  if (lastCheck?.pain_or_discomfort)
    alerts.push("Dor ou desconforto informado no último check-in");
  if (lastCheck && lastCheck.energy <= 2)
    alerts.push("Energia baixa no último check-in");
  if (lastCheck && lastCheck.sleep_quality <= 2)
    alerts.push("Sono abaixo do ideal");
  if (
    weekSessions.length < (Number(a.training_days) || 3) &&
    new Date().getDay() >= 5
  )
    alerts.push("Meta semanal de treinos em risco");
  if (!progress.length) alerts.push("Avaliação corporal ainda não registrada");
  const recentExercises = [];
  for (const l of logs) {
    if (!recentExercises.some((x) => x.exercise_name === l.exercise_name))
      recentExercises.push(l);
    if (recentExercises.length === 3) break;
  }
  return (
    <section className="trainerStudent trainerWorkspace completeCoach">
      <button className="backStudent" onClick={back}>
        <ChevronLeft /> Voltar aos alunos
      </button>
      <div className="coachCommand">
        <div className="coachStudentIdentity">
          <span className="coachStudentPhoto">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={`Foto de ${student.full_name}`}
              />
            ) : (
              student.full_name?.slice(0, 2).toUpperCase()
            )}
          </span>
          <div>
            <span>VISÃO 360° DO ALUNO</span>
            <h2>{student.full_name}</h2>
            <p>
              {a.goal || "Objetivo pendente"} •{" "}
              {a.experience_level || "Nível pendente"} •{" "}
              {a.training_days || "—"}x por semana
            </p>
          </div>
        </div>
        <div>
          <button onClick={load}>Atualizar dados</button>
          <button className="primary" onClick={() => setManage(true)}>
            Editar prontuário
          </button>
        </div>
      </div>
      {alerts.length ? (
        <div className="coachAlerts">
          <header>
            <AlertTriangle />
            <b>
              {alerts.length}{" "}
              {alerts.length === 1 ? "ponto exige" : "pontos exigem"} atenção
            </b>
          </header>
          {alerts.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      ) : (
        <div className="coachAllGood">
          <Check /> Nenhum alerta importante no momento.
        </div>
      )}
      <div className="coachGoalsPhotos">
        <section>
          <span>METAS DO ALUNO</span>
          <h3>Próximos objetivos</h3>
          <div>
            <p>
              <small>Peso alvo</small>
              <b>
                {bodyGoals.target_weight_kg
                  ? `${bodyGoals.target_weight_kg} kg`
                  : "—"}
              </b>
            </p>
            <p>
              <small>Data alvo</small>
              <b>
                {bodyGoals.target_date
                  ? new Date(
                      `${bodyGoals.target_date}T12:00`,
                    ).toLocaleDateString("pt-BR")
                  : "—"}
              </b>
            </p>
          </div>
        </section>
        <section>
          <span>EVOLUÇÃO VISUAL</span>
          <h3>Fotos autorizadas</h3>
          <div className="coachProgressPhotos">
            {progressPhotos.length ? (
              progressPhotos.slice(0, 3).map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.photo_url} alt={photo.pose} />
                  <figcaption>
                    {photo.pose}
                    <small>
                      {new Date(`${photo.taken_on}T12:00`).toLocaleDateString(
                        "pt-BR",
                      )}
                    </small>
                  </figcaption>
                </figure>
              ))
            ) : (
              <p>Nenhuma foto registrada.</p>
            )}
          </div>
        </section>
      </div>
      <div className="coachKpis">
        <article>
          <small>TREINOS NA SEMANA</small>
          <b>
            {weekSessions.length}/{a.training_days || 3}
          </b>
          <span>{completion}% de conclusão média</span>
        </article>
        <article>
          <small>PESO ATUAL</small>
          <b>{latest.weight_kg ? `${latest.weight_kg} kg` : "—"}</b>
          <span>
            {weightDelta === null
              ? "Sem comparação"
              : `${+weightDelta > 0 ? "+" : ""}${weightDelta} kg no período`}
          </span>
        </article>
        <article>
          <small>AVALIAÇÕES</small>
          <b>{progress.length}</b>
          <span>registros corporais no histórico</span>
        </article>
      </div>
      <div className="coachDashboardGrid">
        <section className="coachPanel clientProfile">
          <header>
            <div>
              <span>PERFIL</span>
              <h3>Dados essenciais</h3>
            </div>
            <button onClick={() => setManage(true)}>Editar</button>
          </header>
          <div>
            {[
              ["Objetivo", a.goal],
              ["Idade", a.age ? `${a.age} anos` : null],
              ["Altura", a.height_cm ? `${a.height_cm} cm` : null],
              ["Local", a.training_place],
              ["Atividade", a.activity_level],
              ["Equipamentos", a.equipment],
            ].map(([l, v]) => (
              <p key={l}>
                <span>{l}</span>
                <b>{v || "—"}</b>
              </p>
            ))}
          </div>
          {a.restrictions && (
            <footer>
              <p>
                <b>Limitações físicas:</b>{" "}
                {a.restrictions || "Nenhuma informada"}
              </p>
            </footer>
          )}
        </section>
        <section className="coachPanel checkinPanel">
          <header>
            <div>
              <span>ÚLTIMO CHECK-IN</span>
              <h3>Recuperação e adesão</h3>
            </div>
          </header>
          {lastCheck ? (
            <>
              <div className="scoreRows">
                {[
                  ["Energia", lastCheck.energy],
                  ["Sono", lastCheck.sleep_quality],
                  ["Dificuldade", lastCheck.training_difficulty],
                ].map(([l, v]) => (
                  <p key={l}>
                    <span>{l}</span>
                    <i>
                      <em style={{ width: `${v * 20}%` }} />
                    </i>
                    <b>{v}/5</b>
                  </p>
                ))}
              </div>
              <blockquote>
                {lastCheck.notes ||
                  lastCheck.recommendation_text ||
                  "Sem observações."}
              </blockquote>
            </>
          ) : (
            <p className="emptyCoachData">
              O aluno ainda não realizou check-in.
            </p>
          )}
        </section>
        <section className="coachPanel">
          <header>
            <div>
              <span>DESEMPENHO</span>
              <h3>Últimas cargas registradas</h3>
            </div>
          </header>
          <div className="recentLoads">
            {recentExercises.length ? (
              recentExercises.map((x) => (
                <p key={x.id}>
                  <span>
                    <b>{x.exercise_name}</b>
                    <small>
                      {new Date(x.created_at).toLocaleDateString("pt-BR")}
                    </small>
                  </span>
                  <strong>
                    {x.weight_kg || "—"} kg × {x.repetitions || "—"}
                  </strong>
                </p>
              ))
            ) : (
              <p className="emptyCoachData">Nenhuma carga registrada.</p>
            )}
          </div>
        </section>
        <section className="coachPanel coachWide">
          <header>
            <div>
              <span>MEDIDAS ATUAIS</span>
              <h3>Avaliação corporal completa</h3>
            </div>
            <button onClick={() => setManage(true)}>Nova medição</button>
          </header>
          <div className="allMeasures">
            {circumferenceFields.map(([k, l]) => (
              <p key={k}>
                <span>{l}</span>
                <b>{latest[k] != null ? `${latest[k]} cm` : "—"}</b>
              </p>
            ))}
          </div>
        </section>
        <section className="coachPanel coachWide">
          <header>
            <div>
              <span>ATIVIDADE RECENTE</span>
              <h3>Linha do tempo</h3>
            </div>
          </header>
          <div className="coachTimeline">
            {[
              ...sessions.slice(0, 3).map((x) => ({
                date: x.completed_at,
                title: `Treino ${x.workout_code} — ${x.workout_title}`,
                detail: `${x.completed_exercises}/${x.total_exercises} exercícios`,
              })),
              ...progress.slice(0, 3).map((x) => ({
                date: x.recorded_at + "T12:00",
                title: "Avaliação corporal",
                detail: `${x.weight_kg} kg`,
              })),
            ]
              .sort((x, y) => new Date(y.date) - new Date(x.date))
              .slice(0, 3)
              .map((x, i) => (
                <article key={`${x.date}-${i}`}>
                  <i />
                  <div>
                    <b>{x.title}</b>
                    <small>
                      {x.detail} •{" "}
                      {new Date(x.date).toLocaleDateString("pt-BR")}
                    </small>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
