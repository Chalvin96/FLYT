import { Button } from '@/components/common/Button/Button';
import { Modal } from '@/components/common/Modal/Modal';

interface DisconnectChatGPTModalProps {
  isOpen: boolean;
  isDisconnecting: boolean;
  onClose: () => void;
  onDisconnect: () => Promise<boolean | void> | boolean | void;
}

export function DisconnectChatGPTModal({
  isOpen,
  isDisconnecting,
  onClose,
  onDisconnect,
}: DisconnectChatGPTModalProps) {
  return (
    <Modal
      description="Flyt will delete its copy of the connection and ask OpenAI to revoke it."
      footer={
        <>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isDisconnecting}
            onClick={async () => {
              if ((await onDisconnect()) !== false) onClose();
            }}
            type="button"
            variant="destructive"
          >
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Disconnect ChatGPT?"
    >
      <p className="type-caption text-muted-foreground">
        Deleting your Flyt account also asks OpenAI to revoke this connection.
      </p>
    </Modal>
  );
}
