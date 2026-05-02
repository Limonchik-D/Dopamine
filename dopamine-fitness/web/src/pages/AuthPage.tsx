import { useEffect } from "react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin, useRegister } from "../features/auth/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { toDiagnosticSuffix, toUserMessage } from "../services/apiErrors";
import { setAuthToken } from "../services/auth";

export function AuthPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [errorText, setErrorText] = useState("");

  const login = useLogin();
  const register = useRegister();

  const validationError = useMemo(() => {
    const normalizedEmail = email.trim();
    const normalizedUsername = username.trim();

    if (!normalizedEmail) return "Введите email";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) return "Некорректный email";

    if (isRegister) {
      if (!normalizedUsername) return "Введите username";
      if (normalizedUsername.length < 3) return "Username минимум 3 символа";
      if (normalizedUsername.length > 32) return "Username максимум 32 символа";
      if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
        return "Username: только латиница, цифры, _ и -";
      }
    }

    if (!password) return "Введите пароль";
    if (password.length < 8) return "Пароль минимум 8 символов";
    if (password.length > 128) return "Пароль слишком длинный";

    return "";
  }, [email, isRegister, password, username]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    setAuthToken(token);
    params.delete("token");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    try {
      if (isRegister) {
        await register.mutateAsync({
          email: email.trim(), username: username.trim(), password,
          weight_kg: weightKg ? parseFloat(weightKg) : undefined,
          height_cm: heightCm ? parseFloat(heightCm) : undefined,
        });
      } else {
        await login.mutateAsync({ email: email.trim(), password });
      }
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorText(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  const onGoogleLogin = () => {
    const origin = window.location.origin;
    window.location.href = `/api/auth/google/start?origin=${encodeURIComponent(origin)}`;
  };

  return (
    <Card>
      <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
      <form onSubmit={onSubmit} className="stack">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        {isRegister && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_-]+"
            required
          />
        )}
        <input
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          minLength={8}
          maxLength={128}
          required
        />
        {isRegister && (
          <div className="auth-body-row">
            <div className="auth-body-field">
              <label className="auth-body-label">Вес (кг)</label>
              <input
                className="input"
                type="number" min="20" max="500" step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="70"
              />
            </div>
            <div className="auth-body-field">
              <label className="auth-body-label">Рост (см)</label>
              <input
                className="input"
                type="number" min="100" max="300" step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="175"
              />
            </div>
          </div>
        )}
        <Button type="submit" disabled={Boolean(validationError) || login.isPending || register.isPending}>
          {isRegister ? "Создать аккаунт" : "Войти"}
        </Button>
        <Button type="button" onClick={onGoogleLogin}>Войти через Google</Button>
        {errorText && <p className="error-text">{errorText}</p>}
      </form>
      <Button type="button" onClick={() => setIsRegister((x) => !x)}>
        {isRegister ? "У меня уже есть аккаунт" : "Создать аккаунт"}
      </Button>
    </Card>
  );
}
