"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import useResearchAPI from "@/hooks/useResearchAPI";
import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";

const Header = dynamic(() => import("@/components/Internal/Header"));
const Setting = dynamic(() => import("@/components/Setting"));
const Topic = dynamic(() => import("@/components/Research/Topic"));
const Feedback = dynamic(() => import("@/components/Research/Feedback"));
const SearchResult = dynamic(() => import("@/components/Research/SearchResult"));
const FinalReport = dynamic(() => import("@/components/Research/FinalReport"));
const History = dynamic(() => import("@/components/History"));
const Knowledge = dynamic(() => import("@/components/Knowledge"));

function Home() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { getSession } = useResearchAPI();
  const taskStore = useTaskStore();
  const {
    openSetting,
    setOpenSetting,
    openHistory,
    setOpenHistory,
    openKnowledge,
    setOpenKnowledge,
  } = useGlobalStore();

  // const { theme } = useSettingStore();
  const { setTheme } = useTheme();

  useLayoutEffect(() => {
    const settingStore = useSettingStore.getState();
    setTheme(settingStore.theme);
  }, [setTheme]);

  // Handle sessionId URL parameter
  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (sessionId && sessionId !== taskStore.id) {
      console.log("Loading session from URL:", sessionId);
      taskStore.setId(sessionId);
      getSession(sessionId);
    }
  }, [searchParams, getSession, taskStore]);
  return (
    <div className="max-lg:max-w-screen-md max-w-screen-lg mx-auto px-4">
      <Header />
      <main>
        <Topic />
        <Feedback />
        <SearchResult />
        <FinalReport />
      </main>
      <footer className="my-4 text-center text-sm text-gray-600 print:hidden">
        <a href="https://github.com/u14app/" target="_blank" rel="noopener">
          {t("copyright", {
            name: "U14App",
          })}
        </a>
      </footer>
      <aside className="print:hidden">
        <Setting open={openSetting} onClose={() => setOpenSetting(false)} />
        <History open={openHistory} onClose={() => setOpenHistory(false)} />
        <Knowledge open={openKnowledge} onClose={() => setOpenKnowledge(false)} />
      </aside>
    </div>
  );
}

export default Home;
