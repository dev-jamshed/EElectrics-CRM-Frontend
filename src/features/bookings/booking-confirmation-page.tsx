import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";

const logoUrl = "https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png";

type PublicBooking = {
  id: string;
  documentNo: string;
  status: string;
};

export function BookingConfirmationPage() {
  const { token } = useParams();
  const confirmMutation = useMutation({
    mutationFn: async () => (await api.post<PublicBooking>(`/public/bookings/${token}/confirm`, {})).data
  });

  useEffect(() => {
    if (token && confirmMutation.isIdle) confirmMutation.mutate();
  }, [token, confirmMutation]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f6] px-4 py-10">
      <section className="w-full max-w-[490px] rounded-xl bg-white px-6 py-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:px-12">
        <img src={logoUrl} title="logo" alt="Company logo" className="mx-auto w-full max-w-[270px]" />

        {confirmMutation.isPending || confirmMutation.isIdle ? (
          <div className="mt-8 flex items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Confirming booking
          </div>
        ) : confirmMutation.isError ? (
          <>
            <h1 className="mt-7 text-4xl font-semibold text-[#f37335] sm:text-[44px]">Booking Link Invalid</h1>
            <p className="mt-6 text-base tracking-[0.08em] text-slate-400 sm:text-lg">Please contact E Electrics for help.</p>
          </>
        ) : (
          <>
            <h1 className="mt-7 text-4xl font-semibold text-[#f37335] sm:text-[44px]">Booking Confirmed</h1>
            <p className="mt-6 text-base tracking-[0.08em] text-slate-400 sm:text-lg">Thanks for Confirmation to Book your Booking.</p>
          </>
        )}
      </section>
    </main>
  );
}
