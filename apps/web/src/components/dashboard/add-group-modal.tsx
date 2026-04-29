import { useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AddGroupData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  imageUrl: string | null;
}

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddGroupData) => void;
}

export function AddGroupModal({ isOpen, onClose, onSubmit }: AddGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, startDate, endDate, imageUrl: imagePreview });
    setName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setImagePreview(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button 
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-ink-900 hover:bg-white/80 backdrop-blur-md transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <form onSubmit={handleSubmit}>
          {/* Header Image Area */}
          <div className="relative h-40 w-full bg-mint-100 group">
            {imagePreview ? (
              <img src={imagePreview} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImagePlus className="h-8 w-8 text-mint-400 group-hover:scale-110 transition-transform" />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <span className="sr-only">Upload header photo</span>
            </label>
            <div className="absolute bottom-3 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm backdrop-blur-sm pointer-events-none">
              Add Header Photo
            </div>
          </div>

          <div className="flex flex-col gap-4 p-6">
            <div>
              <Input
                placeholder="Group Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="font-bold text-lg h-14"
              />
            </div>
            <div>
              <Input
                placeholder="Location or description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="date"
                placeholder="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                placeholder="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" size="lg" className="w-full sm:w-auto font-bold px-8">
                Create Group
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
