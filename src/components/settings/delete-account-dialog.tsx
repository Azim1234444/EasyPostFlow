'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteUserAccount } from '@/lib/actions/user';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfirmed = confirmationText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const res = await deleteUserAccount();
    if (res?.error) {
      setErrorMessage(res.error);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setConfirmationText('');
          setErrorMessage(null);
          setOpen(true);
        }}
      >
        Delete Account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center text-red-600">
              Permanently Delete Account?
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              This action cannot be undone. All your scheduled posts, uploaded videos, connected
              TikTok &amp; Shopee platform accounts, and media files will be permanently erased.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Label htmlFor="delete-confirm" className="text-xs font-medium">
              To confirm, type <span className="font-bold text-red-600">DELETE</span> below:
            </Label>
            <Input
              id="delete-confirm"
              placeholder="DELETE"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={isDeleting}
              className="font-mono text-center tracking-wider"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!isConfirmed || isDeleting}
              onClick={handleDelete}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Erasing Data...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
