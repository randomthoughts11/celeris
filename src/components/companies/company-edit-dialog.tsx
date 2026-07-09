"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyAction } from "@/features/companies/actions";
import type { CompanyWithMetrics } from "@/types";

export function CompanyEditDialog({ company }: { company: CompanyWithMetrics }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateCompanyAction(company.id, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Company updated");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {company.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={company.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              name="industry"
              defaultValue={company.industry ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              defaultValue={company.website ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyBudget">Monthly ad budget</Label>
            <Input
              id="monthlyBudget"
              name="monthlyBudget"
              type="number"
              min={0}
              defaultValue={company.monthly_budget}
            />
          </div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
