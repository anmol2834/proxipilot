"use client";

import React, { Suspense } from "react";
import { SigninShowcasePanel } from "./SigninShowcasePanel";
import { SigninAuthForm } from "./SigninAuthForm";

export function SignInPage() {
  return (
    <main className="pp-signup-root">
      {/* Left Side: Product Showcase Hero */}
      <SigninShowcasePanel />

      {/* Right Side: Authentication Form with Suspense for useSearchParams */}
      <Suspense fallback={<div className="pp-signin-form-panel" />}>
        <SigninAuthForm />
      </Suspense>
    </main>
  );
}
