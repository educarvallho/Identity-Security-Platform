# Estratégia de Backup

## Classificação dos Dados

| Componente           | Criticidade         | Motivo                                           |
|----------------------|---------------------|--------------------------------------------------|
| PostgreSQL Auth      | 🔴 CRÍTICO          | Persistência do Keycloak e Infisical             |
| Infisical (via DB)   | 🔴 CRÍTICO          | Todos os secrets corporativos                    |
| Keycloak realm export| 🟠 MUITO IMPORTANTE | Configuração IAM, clients, flows, roles          |
| Configs operacionais | 🟡 IMPORTANTE       | Nginx, cloudflared, scripts — versionados no Git |
| Redis                | 🟢 NÃO CRÍTICO      | Cache ephemeral — reconstrói automaticamente     |

## Frequência Recomendada

| Tipo            | Frequência  | Executado por                         |
|-----------------|-------------|---------------------------------------|
| pg_dumpall      | Diário      | `bash scripts/backup.sh`             |
| Keycloak realm  | Diário      | Incluído em `backup.sh`              |
| Snapshot VPS    | Semanal     | Painel do provedor (Hetzner, etc.)   |
| Teste de restore | Mensal     | Manual — ver seção Validação         |

## Regra 3-2-1

A estratégia correta para ambiente enterprise:

- **3 cópias** dos dados críticos
- **2 mídias diferentes** (local + remoto)
- **1 backup offsite** (fora da VPS)

| Local                  | Tipo           | Implementação           |
|------------------------|----------------|-------------------------|
| VPS principal          | Backup local   | `BACKUP_DIR` no `.env`  |
| Hetzner Storage Box    | Offsite        | rsync/rclone agendado   |
| S3-compatível (Wasabi) | Cold backup    | rclone + object storage |

## Executar Backup

```bash
# Manual
bash scripts/backup.sh

# Automático via crontab (executa às 02:00 todo dia)
crontab -e
# Adicione:
0 2 * * * /opt/iam-platform/scripts/backup.sh >> /var/log/iam-backup.log 2>&1
```

## Sincronização Offsite (Hetzner Storage Box)

```bash
# Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# Configurar destino
rclone config  # Adicione remote "hetzner-box" do tipo sftp

# Sincronizar após backup (adicione ao crontab após o backup.sh)
rclone sync /opt/backups/iam-platform remote:iam-platform-backup \
    --exclude "*.sql" --min-age 1m
```

## Criptografia dos Backups

Os backups são criptografados com GPG usando a passphrase `BACKUP_ENCRYPTION_KEY` do `.env`.

```bash
# Verificar se backup está criptografado
file /opt/backups/iam-platform/postgres-auth_*.dump.gpg
# Expected: ... GPG symmetrically encrypted data (AES256 cipher)

# Testar descriptografia sem restaurar
gpg --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" --batch \
    /opt/backups/iam-platform/postgres-auth_YYYYMMDD.dump.gpg | head -5
```

## Validação Mensal de Restore

**Execute todo mês** — backups sem teste de restore são inúteis:

1. `bash scripts/backup.sh`
2. Provisione VM temporária (mesmo SO e versão do Docker)
3. `bash scripts/restore.sh /opt/backups/iam-platform/<backup>.dump.gpg`
4. Valide autenticação no Keycloak
5. Valide acesso ao Infisical
6. Documente o tempo de recuperação (RTO)
7. Destrua a VM temporária

Veja procedimento completo em: [restore.md](restore.md)
