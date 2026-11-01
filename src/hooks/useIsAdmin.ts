import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function check(userId: string | undefined) {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (active) setIsAdmin(!error && data?.role === "admin");
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void check(session?.user.id);
    });
    void supabase.auth.getSession().then(({ data }) => check(data.session?.user.id));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
