import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Users, LayoutDashboard, ReceiptText, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";

export default function GroupDetailsPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "members">("overview");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Mock group data based on ID or fallback
  const group = {
    name: "PADAGAT WHEN",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80",
    total: 1250.00,
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "expenses", label: "Expenses", icon: ReceiptText },
    { id: "members", label: "Members", icon: Users },
  ] as const;

  return (
    <div className="min-h-[100svh] bg-white flex flex-col">
      {/* Header section with gradient background */}
      <div className="relative bg-gradient-to-br from-[#00558C] to-[#00A1D6] px-4 pt-12 pb-24 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-3xl z-10">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm">
              <ListFilter className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 pl-2">
            <img 
              src={group.imageUrl} 
              alt={group.name} 
              className="h-16 w-16 rounded-xl object-cover shadow-lg border border-white/20"
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight uppercase">{group.name}</h1>
              <div className="text-white/80 text-xs font-medium mt-1">Group Total</div>
              <div className="text-2xl font-bold">₱{group.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <div className="absolute right-0 bottom-2 flex gap-2">
            <Button 
              size="sm" 
              className="rounded-full bg-ink-900 text-white shadow-xl hover:bg-ink-800"
              onClick={() => setIsAddExpenseOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white relative px-4 pt-6 mx-auto w-full max-w-3xl">
        {/* Tab Navigation */}
        <div className="flex border-b border-ink-100 mb-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 border-b-2",
                  isActive 
                    ? "border-mint-500 text-mint-600" 
                    : "border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4">
              {/* Mock Expenses */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-ink-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#00558C]/10 flex items-center justify-center text-[#00558C] font-bold text-xs flex-col">
                    <span>APR</span>
                    <span>14</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-ink-900 text-sm uppercase">SIARGAO WINDS</h4>
                    <p className="text-xs text-ink-500 font-medium">Ferry tickets</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600 text-sm">₱4,500.00</div>
                  <div className="text-[10px] text-danger font-bold uppercase tracking-wider">You Owe</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-ink-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#00558C]/10 flex items-center justify-center text-[#00558C] font-bold text-xs flex-col">
                    <span>APR</span>
                    <span>13</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-ink-900 text-sm uppercase">Meals</h4>
                    <p className="text-xs text-ink-500 font-medium">Lunch at Kermit</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600 text-sm">₱1,250.00</div>
                  <div className="text-[10px] text-success font-bold uppercase tracking-wider">You Lent</div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === "expenses" && (
            <div className="text-center py-12">
              <ReceiptText className="h-12 w-12 text-ink-200 mx-auto mb-3" />
              <h3 className="text-ink-900 font-semibold">No expenses yet</h3>
              <p className="text-ink-500 text-sm mt-1">Add an expense to get started.</p>
            </div>
          )}

          {activeTab === "members" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-white border border-ink-100 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">G</div>
                  <div>
                    <div className="font-bold text-sm text-ink-900">George (You)</div>
                    <div className="text-xs text-success font-medium">Lent ₱1,250.00</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border border-ink-100 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">A</div>
                  <div>
                    <div className="font-bold text-sm text-ink-900">Alice</div>
                    <div className="text-xs text-danger font-medium">Owes ₱1,250.00</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AddExpenseModal isOpen={isAddExpenseOpen} onClose={() => setIsAddExpenseOpen(false)} />
    </div>
  );
}
