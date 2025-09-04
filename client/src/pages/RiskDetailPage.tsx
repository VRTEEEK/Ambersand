import { useRoute } from "wouter";
import { RiskDetail } from "@/components/risk/RiskDetail";
import AppLayout from "@/components/layout/AppLayout";

export default function RiskDetailPage() {
  const [, params] = useRoute("/risks/:id");
  const riskId = params?.id ? parseInt(params.id) : null;

  if (!riskId) {
    return (
      <AppLayout>
        <div className="text-center py-8 text-red-500">
          Invalid risk ID
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <RiskDetail riskId={riskId} />
    </AppLayout>
  );
}