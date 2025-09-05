import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v:boolean)=>void;
  candidates: Array<{ userId:string; name:string }>;
  onConfirm: (p:{ toUserId:string; comment:string })=>void;
};

export default function ReturnDialog({ open, onOpenChange, candidates, onConfirm }: Props) {
  const [toUserId, setToUserId] = useState<string>("");
  const [comment, setComment] = useState("");

  const canSubmit = toUserId && comment.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return task to collaborator</DialogTitle>
          <DialogDescription>Select a collaborator in the route and include a note.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Collaborator</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger><SelectValue placeholder="Select collaborator" /></SelectTrigger>
              <SelectContent>
                {candidates.map(c => (
                  <SelectItem key={c.userId} value={c.userId}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Comment</Label>
            <Textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="What should be rectified?" rows={4}/>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button onClick={()=>{ if (canSubmit) onConfirm({ toUserId, comment: comment.trim() }); }} disabled={!canSubmit}>
              Return task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}