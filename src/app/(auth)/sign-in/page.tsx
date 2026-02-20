// ProConnect — Sign In Page
// Animated SSO sign-in screen with Office 365 button

"use client";

import { motion } from "framer-motion";
import { Shield, ArrowRight } from "lucide-react";
import { signInAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-blue/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-brand-blue/3 rounded-full translate-x-1/4 translate-y-1/4" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header strip */}
          <div className="h-2 bg-gradient-to-r from-brand-blue to-[#084f96]" />

          <div className="px-8 pt-10 pb-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex justify-center mb-6"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue text-white font-bold text-2xl shadow-lg shadow-brand-blue/25">
                MP
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-center mb-8"
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1.5">
                Welcome to ProConnect
              </h1>
              <p className="text-sm text-brand-grey">
                Sign in with your MortgagePros account
              </p>
            </motion.div>

            {/* Sign-in button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <form action={signInAction}>
                <Button
                  type="submit"
                  className="w-full h-12 bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold rounded-xl gap-3 shadow-md shadow-brand-blue/20 transition-all hover:shadow-lg hover:shadow-brand-blue/30 cursor-pointer"
                >
                  {/* Microsoft icon */}
                  <svg viewBox="0 0 21 21" className="w-5 h-5" fill="currentColor">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Sign in with Office 365
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              </form>
            </motion.div>

            {/* Security note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex items-center justify-center gap-1.5 mt-6 text-xs text-brand-grey/70"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Secured by Microsoft Entra ID</span>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="text-center text-xs text-brand-grey/50 mt-6"
        >
          &copy; {new Date().getFullYear()} MortgagePros. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
}
