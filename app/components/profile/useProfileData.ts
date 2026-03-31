/**
 * useProfileData -- Composes user and admin dashboard hooks.
 */

import { useEffect, useState } from "react";
import type { ProfileUser, UserTab, AdminTab } from "./types";
import { useProfileUserData } from "./useProfileUserData";
import { useProfileAdminData } from "./useProfileAdminData";

export function useProfileData(user: ProfileUser) {
  const isAdmin = user.role === "admin";
  const [userTab, setUserTab] = useState<UserTab>("registered");
  const [adminTab, setAdminTab] = useState<AdminTab>("events");

  const userData = useProfileUserData(isAdmin);
  const adminData = useProfileAdminData(isAdmin, adminTab);
  const {
    loadRegisteredEvents,
    loadSavedEvents,
    registeredStatus,
  } = userData;

  useEffect(() => {
    if (isAdmin) return;
    if (userTab === "registered") {
      void loadRegisteredEvents();
      return;
    }
    if (userTab === "saved") {
      void loadSavedEvents();
    }
  }, [isAdmin, loadRegisteredEvents, loadSavedEvents, userTab]);

  useEffect(() => {
    if (isAdmin) return;
    if (userTab === "registered") {
      void loadRegisteredEvents();
    }
  }, [isAdmin, loadRegisteredEvents, registeredStatus, userTab]);

  return {
    isAdmin,
    userTab,
    setUserTab,
    adminTab,
    setAdminTab,
    ...userData,
    ...adminData,
  };
}
