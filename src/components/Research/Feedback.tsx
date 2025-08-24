"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/Internal/Button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import useAccurateTimer from "@/hooks/useAccurateTimer";
import useResearchAPI from "@/hooks/useResearchAPI";
import { useTaskStore } from "@/store/task";

const MagicDown = dynamic(() => import("@/components/MagicDown"));

const formSchema = z.object({
  feedback: z.string(),
});

function Feedback() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { status, executeResearch, writeReportPlan, submitFeedback, streaming, session } =
    useResearchAPI();
  const { formattedTime, start: accurateTimerStart, stop: accurateTimerStop } = useAccurateTimer();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isResearch, setIsResaerch] = useState<boolean>(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feedback: taskStore.feedback,
    },
  });

  async function startDeepResearch() {
    try {
      accurateTimerStart();
      setIsResaerch(true);
      await executeResearch();
    } finally {
      setIsResaerch(false);
      accurateTimerStop();
    }
  }

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    const { setFeedback } = useTaskStore.getState();
    setFeedback(values.feedback);

    try {
      accurateTimerStart();
      setIsThinking(true);

      if (values.feedback.trim()) {
        // Submit feedback first, then create plan
        await submitFeedback(values.feedback);
      }

      await writeReportPlan();
      setIsThinking(false);
    } finally {
      accurateTimerStop();
    }
  }

  useEffect(() => {
    form.setValue("feedback", taskStore.feedback);
  }, [taskStore.feedback, form]);

  useEffect(() => {
    // Sync session data with local task store when session changes
    if (session) {
      if (session.reportPlan && session.reportPlan !== taskStore.reportPlan) {
        taskStore.updateReportPlan(session.reportPlan);
      }
      if (session.tasks && session.tasks.length > 0) {
        taskStore.update(session.tasks);
      }
    }
  }, [session, taskStore]);

  return (
    <section className="p-4 border rounded-md mt-4 print:hidden">
      <h3 className="font-semibold text-lg border-b mb-2 leading-10">
        {t("research.feedback.title")}
      </h3>
      {taskStore.questions === "" ? (
        <div>{t("research.feedback.emptyTip")}</div>
      ) : (
        <div>
          <h4 className="mt-4 text-base font-semibold">{t("research.feedback.questions")}</h4>
          <MagicDown
            className="mt-2 min-h-20"
            value={taskStore.questions}
            onChange={(value) => taskStore.updateQuestions(value)}
          ></MagicDown>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <FormField
                control={form.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 font-semibold">
                      {t("research.feedback.feedbackLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t("research.feedback.feedbackPlaceholder")}
                        disabled={isThinking || streaming}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button className="mt-4 w-full" type="submit" disabled={isThinking || streaming}>
                {isThinking || streaming ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    <span>{status}</span>
                    <small className="font-mono">{formattedTime}</small>
                  </>
                ) : taskStore.reportPlan === "" ? (
                  t("research.common.writeReportPlan")
                ) : (
                  t("research.common.rewriteReportPlan")
                )}
              </Button>
            </form>
          </Form>
        </div>
      )}
      {taskStore.reportPlan !== "" ? (
        <div className="mt-6">
          <h4 className="text-base font-semibold">{t("research.feedback.reportPlan")}</h4>
          <MagicDown
            className="mt-2 min-h-20"
            value={taskStore.reportPlan}
            onChange={(value) => taskStore.updateReportPlan(value)}
          ></MagicDown>
          <Button
            className="w-full mt-4"
            variant="default"
            onClick={() => startDeepResearch()}
            disabled={isResearch || streaming}
          >
            {isResearch || streaming ? (
              <>
                <LoaderCircle className="animate-spin" />
                <span>{status}</span>
                <small className="font-mono">{formattedTime}</small>
              </>
            ) : taskStore.tasks.length === 0 ? (
              t("research.common.startResearch")
            ) : (
              t("research.common.restartResearch")
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default Feedback;
