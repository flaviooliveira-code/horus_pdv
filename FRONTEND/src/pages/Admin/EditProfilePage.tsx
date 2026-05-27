/**
 * Arquivo: src/pages/Admin/EditProfilePage.tsx
 * Objetivo: permite visualizar dados da conta, atualizar avatar e alterar senha do usuário autenticado.
 * Entradas esperadas: recebe dados do usuário e callbacks para upload/remoção de avatar e troca de senha.
 */

import { Camera, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useStatusDialog } from "@/hooks/Dialog";
import PageLayout from "@/layout/PageLayout";

type ChangePasswordResult = {
  success: boolean;
  message: string;
};

type EditProfilePageProps = {
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  userAvatarUrl: string | null;
  onUploadAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
  onChangePassword: (currentPassword: string, nextPassword: string) => Promise<ChangePasswordResult>;
  onUpdateProfile: (name: string, email: string, phone: string) => Promise<ChangePasswordResult>;
};

export default function EditProfilePage({
  userName,
  userEmail,
  userPhone,
  userRole,
  userAvatarUrl,
  onUploadAvatar,
  onRemoveAvatar,
  onChangePassword,
  onUpdateProfile,
}: EditProfilePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusDialog = useStatusDialog();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileName, setProfileName] = useState(userName);
  const [profileEmail, setProfileEmail] = useState(userEmail);
  const [profilePhone, setProfilePhone] = useState(userPhone);
  const [savingProfile, setSavingProfile] = useState(false);

  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    onUploadAvatar(file);
    event.target.value = "";
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      statusDialog.error("Preencha todos os campos de senha.");
      return;
    }

    if (newPassword.length < 8) {
      statusDialog.error("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      statusDialog.error("A confirmação da nova senha não confere.");
      return;
    }

    const result = await onChangePassword(currentPassword, newPassword);
    if (!result.success) {
      statusDialog.error(result.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    statusDialog.success(result.message);
  };

  const handleUpdateProfile = async () => {
    if (profileName.trim().length < 3) {
      statusDialog.error("Informe um nome com pelo menos 3 caracteres.");
      return;
    }

    if (!profileEmail.includes("@")) {
      statusDialog.error("Informe um e-mail válido.");
      return;
    }

    setSavingProfile(true);
    const result = await onUpdateProfile(profileName, profileEmail, profilePhone);
    setSavingProfile(false);
    if (!result.success) {
      statusDialog.error(result.message);
      return;
    }

    statusDialog.success(result.message);
  };

  return (
    <PageLayout className="space-y-4 py-4 md:py-6 lg:py-8">
      <section className="card overflow-hidden rounded-2xl">
        <div className="border-b border-border-primary bg-gradient-to-r from-secondary/10 via-bg-light to-accent/10 px-4 py-4 md:px-5">
          <h3 className="text-lg font-semibold text-text-primary">Perfil do usuário</h3>
          <p className="text-sm text-text-secondary">
            Dados de acesso e foto de exibição da sua conta.
          </p>
        </div>

        <div className="grid gap-6 px-4 py-5 md:px-5 lg:grid-cols-[240px_1fr]">
          <div className="flex self-start flex-col items-center rounded-2xl border border-border-primary bg-bg-primary p-4">
            <div className="relative">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-accent to-secondary text-3xl font-bold text-white shadow-md md:h-36 md:w-36">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={`Avatar de ${userName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials || "HP"
              )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -right-1 -bottom-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-primary bg-white text-accent shadow-sm transition hover:bg-accent/10 md:h-10 md:w-10"
                aria-label="Alterar foto do perfil"
              >
                <Camera size={16} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelectFile}
            />

            <div className="mt-4 flex w-full max-w-xs flex-col items-center gap-3">
              <button
                type="button"
                className="btn-outline-secondary inline-flex min-h-11 w-full items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Subir foto
              </button>
              {userAvatarUrl && (
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-red-50"
                  onClick={onRemoveAvatar}
                >
                  <Trash2 size={14} />
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-primary">
                Nome
              </label>
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-primary">
                Email
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-primary">
                Telefone
              </label>
              <input
                value={profilePhone}
                onChange={(event) => setProfilePhone(event.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-primary">
                Permissão de usuário
              </label>
              <input value={userRole} readOnly disabled className="input-field w-full" />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleUpdateProfile()}
                disabled={savingProfile}
              >
                {savingProfile ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>

            <div className="rounded-xl border border-border-primary bg-bg-primary p-3 md:p-4">
              <p className="text-sm font-semibold text-text-primary">Trocar senha</p>
              <p className="mt-1 text-xs text-text-secondary">
                Após definir a nova senha, ela passa a valer no próximo login.
              </p>

              <div className="mt-3 grid gap-3">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">
                    Senha atual
                  </span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="input-field w-full"
                    placeholder="Digite sua senha atual"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">
                    Nova senha
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="input-field w-full"
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">
                    Confirmar nova senha
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="input-field w-full"
                    placeholder="Repita a nova senha"
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-primary" onClick={() => void handleChangePassword()}>
                  Atualizar senha
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      {statusDialog.Dialog}
    </PageLayout>
  );
}
