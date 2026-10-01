import { ReactNode } from "react";
import { Workflow } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-black text-white p-1 rounded-md">
              <Workflow size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">PostFlow</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10">
          {children}
        </Card>
      </div>
    </div>
  );
}
