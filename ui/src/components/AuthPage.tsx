"use client";
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Todo } from "./Todo";

interface AuthFormData {
  username: string;
  password: string;
}

export function AuthPage() {
  const [loginData, setLoginData] = useState<AuthFormData>({
    username: "",
    password: "",
  });
  const [signupData, setSignupData] = useState<AuthFormData>({
    username: "",
    password: "",
  });
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<"tareas" | "categorias">("tareas");

  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("jwt");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>,
    formType: "login" | "signup"
  ) => {
    const { name, value } = e.target;
    if (formType === "login") {
      setLoginData((prev) => ({ ...prev, [name]: value }));
    } else {
      setSignupData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
    formType: "login" | "signup"
  ) => {
    e.preventDefault();

    if (formType === "login") setLoginError(null);
    else setSignupError(null);

    const url =
      formType === "login"
        ? "http://127.0.0.1:8080/api/login_users"
        : "http://127.0.0.1:8080/api/create_users";

    const payload = formType === "login" ? loginData : signupData;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { message: await res.text() };

      if (!res.ok) {
        const msg = data?.message || `HTTP ${res.status}`;
        if (formType === "login") setLoginError(msg);
        else setSignupError(msg);
        return;
      }

      const token = data?.token;
      if (!token) throw new Error("Success but no token returned.");
      localStorage.setItem("jwt", token);
      setToken(token);
      setView("tareas");
    } catch (err: any) {
      if (formType === "login")
        setLoginError("Error de conexión con el servidor.");
      else setSignupError("Error de conexión con el servidor.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt");
    setToken(null);
  };

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const buttonClass =
    "w-full rounded-md bg-blue-600 py-2 text-white hover:bg-blue-700 transition-colors";

  if (token) {
    return <Todo handleLogout={handleLogout} />;
  }

  return (
    <div className="flex gap-20 h-screen bg-white">
      {/* Login Section */}
      <div className="flex flex-1 items-center justify-center">
        <form
          onSubmit={(e) => handleSubmit(e, "login")}
          className="w-full max-w-sm space-y-4 p-6 bg-white shadow-md rounded-lg"
        >
          <h2 className="text-2xl font-semibold text-center">Login</h2>
          {loginError && (
            <p className="text-red-600 text-center text-sm font-medium">
              {loginError}
            </p>
          )}
          <input
            name="username"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => handleChange(e, "login")}
            required
            className={inputClass}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => handleChange(e, "login")}
            required
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Log In
          </button>
        </form>
      </div>

      {/* Signup Section */}
      <div className="flex flex-1 items-center justify-center">
        <form
          onSubmit={(e) => handleSubmit(e, "signup")}
          className="w-full max-w-sm space-y-4 p-6 bg-white shadow-md rounded-lg"
        >
          <h2 className="text-2xl font-semibold text-center">Sign Up</h2>
          {signupError && (
            <p className="text-red-600 text-center text-sm font-medium">
              {signupError}
            </p>
          )}
          <input
            name="username"
            placeholder="Username"
            value={signupData.username}
            onChange={(e) => handleChange(e, "signup")}
            required
            className={inputClass}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={signupData.password}
            onChange={(e) => handleChange(e, "signup")}
            required
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}
