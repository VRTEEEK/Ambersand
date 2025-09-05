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

export default function RejectDialog({ open, onOpenChange, candidates, onConfirm }: Props) {
  const [toUserId, setToUserId] = useState<string>("");
  const [comment, setComment] = useState("");

  const canSubmit = toUserId && comment.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject and return task</DialogTitle>
          <DialogDescription>Reject this task and return it to a collaborator with feedback on what needs to be fixed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Return to collaborator</Label>
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
            <Label>Rejection reason</Label>
            <Textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Explain why this task is being rejected and what needs to be fixed" rows={4}/>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button 
              onClick={()=>{ if (canSubmit) onConfirm({ toUserId, comment: comment.trim() }); }} 
              disabled={!canSubmit}
              variant="destructive"
            >
              Reject task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}