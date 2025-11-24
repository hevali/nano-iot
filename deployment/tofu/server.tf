locals {
  server_ssh_key = file(var.ssh_key_path)
  server_user    = "webadmin"
  hostname       = length(hcloud_zone_rrset.app) == 1 ? "${hcloud_zone_rrset.app[0].name}.${data.hcloud_zone.main.name}" : data.hcloud_zone.main.name
}

resource "hcloud_ssh_key" "key" {
  name       = "nano-iot-key"
  public_key = data.tls_public_key.key.public_key_openssh
}

resource "hcloud_primary_ip" "ip" {
  name          = "nano-iot-primary-ip"
  datacenter    = "nbg1-dc3"
  type          = "ipv4"
  assignee_type = "server"
  auto_delete   = true
}

resource "hcloud_firewall" "firewall" {
  name = "nano-iot-firewall"

  rule {
    description = "ssh"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    description = "http"
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    description = "https"
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    description = "mqtts"
    direction   = "in"
    protocol    = "tcp"
    port        = "8883"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }
}

resource "hcloud_server" "server" {
  name        = "nano-iot"
  image       = "ubuntu-24.04"
  server_type = "cx23"
  datacenter  = "nbg1-dc3"

  ssh_keys = [hcloud_ssh_key.key.id]

  firewall_ids = [hcloud_firewall.firewall.id]

  public_net {
    ipv4_enabled = true
    ipv4         = hcloud_primary_ip.ip.id
    ipv6_enabled = false
  }

  user_data = <<EOT
#cloud-config
timezone: Europe/Berlin
users:
  - name: ${local.server_user}
    groups: users, sudo
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: true
    ssh_authorized_keys:
      - ${data.tls_public_key.key.public_key_openssh}
package_update: true
package_upgrade: true
write_files:
  - path: /etc/ssh/sshd_config.d/ssh-hardening.conf
    content: |
      PermitRootLogin no
      PasswordAuthentication no
      Port 22
      KbdInteractiveAuthentication no
      ChallengeResponseAuthentication no
      MaxAuthTries 3
      AllowTcpForwarding yes
      X11Forwarding no
      AllowAgentForwarding no
      AuthorizedKeysFile .ssh/authorized_keys
      AllowUsers ${local.server_user}
runcmd:
  # docker
  - "mkdir -p /etc/apt/keyrings"
  - "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
  - "chmod a+r /etc/apt/keyrings/docker.gpg"
  - "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$${UBUNTU_CODENAME:-$VERSION_CODENAME}\") stable\" > /etc/apt/sources.list.d/docker.list"
  - "apt-get update"
  - "DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
  - "systemctl enable docker"
  - "systemctl start docker"
  - "usermod -aG docker ${local.server_user}"
  - "echo '0 3 * * 0 root docker system prune -f > /dev/null 2>&1' >> /etc/crontab"
  # certbot
  - "apt install python3 python3-dev python3-venv libaugeas-dev gcc -y"
  - "python3 -m venv /opt/certbot/"
  - "/opt/certbot/bin/pip install --upgrade pip"
  - "/opt/certbot/bin/pip install certbot"
  - "ln -s /opt/certbot/bin/certbot /usr/bin/certbot"
  # fail2ban
  - "cat > /etc/fail2ban/jail.local << 'EOF'\n[DEFAULT]\nbantime = 3600\nfindtime = 600\nmaxretry = 3\nbackend = systemd\n\n[sshd]\nenabled = true\nport = ssh,22\nbanaction = iptables-multiport\nlogpath = /var/log/auth.log\nEOF"
  - "systemctl enable fail2ban"
  - "systemctl restart fail2ban"
  # updates
  - "DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades"
  - "cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'\nUnattended-Upgrade::Allowed-Origins {\n    \"$${distro_id}:$${distro_codename}-security\";\n    \"$${distro_id}ESM:$${distro_codename}\";\n};\nUnattended-Upgrade::AutoFixInterruptedDpkg \"true\";\nUnattended-Upgrade::MinimalSteps \"true\";\nUnattended-Upgrade::Remove-Unused-Dependencies \"true\";\nUnattended-Upgrade::Automatic-Reboot \"false\";\nEOF"
  - "systemctl enable unattended-upgrades"
  # logs
  - "cat > /etc/logrotate.d/rsyslog << 'EOF'\n/var/log/syslog {\n    daily\n    missingok\n    rotate 7\n    compress\n    delaycompress\n    notifempty\n    create 0640 syslog adm\n    postrotate\n        invoke-rc.d rsyslog rotate > /dev/null\n    endscript\n}\nEOF"
  - "sed -i 's/GRUB_CMDLINE_LINUX=\"/GRUB_CMDLINE_LINUX=\"swapaccount=1 /' /etc/default/grub"
  - "update-grub"
  # restart
  - "shutdown -r +1"
EOT
}

resource "hcloud_zone_rrset" "app" {
  count = var.sub_domain == null ? 0 : 1
  zone  = data.hcloud_zone.main.name
  name  = var.sub_domain
  type  = "A"

  ttl = 720

  records = [
    { value = hcloud_primary_ip.ip.ip_address },
  ]
}

resource "hcloud_zone_rrset" "wildcard" {
  zone = data.hcloud_zone.main.name
  name = length(hcloud_zone_rrset.app) == 1 ? "*.${hcloud_zone_rrset.app[0].name}" : "*"
  type = "A"

  ttl = 720

  records = [
    { value = hcloud_primary_ip.ip.ip_address },
  ]
}

resource "ssh_resource" "certbot_authenticator_hook" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/certbot"]

  file {
    content = templatefile("${path.module}/templates/certbot-authenticator.sh.tftpl", {
      hetzner_api_token : var.hcloud_token,
      dns_zone : data.hcloud_zone.main.name
    })
    destination = "~/certbot/authenticator.sh"
  }

  commands = [
    "sudo chmod +x ~/certbot/authenticator.sh"
  ]
}

resource "ssh_resource" "certbot_cleanup_hook" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/certbot"]

  file {
    content = templatefile("${path.module}/templates/certbot-cleanup.sh.tftpl", {
      hetzner_api_token : var.hcloud_token,
      dns_zone : data.hcloud_zone.main.name
    })
    destination = "~/certbot/cleanup.sh"
  }

  commands = [
    "sudo chmod +x ~/certbot/cleanup.sh"
  ]
}

resource "ssh_resource" "acquire_certificate" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  file {
    content     = "0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q"
    destination = "~/certbot-renew"
  }

  commands = [
    "sudo mv -f ~/certbot-renew /etc/cron.d/certbot-renew",
    "sudo certbot certonly --manual --agree-tos --preferred-challenges=dns --manual-auth-hook ~/certbot/authenticator.sh --manual-cleanup-hook ~/certbot/cleanup.sh -d ${local.hostname} -d *.${local.hostname} -n",
  ]

  depends_on = [ssh_resource.certbot_authenticator_hook, ssh_resource.certbot_cleanup_hook]
}

resource "ssh_resource" "certbot_deploy_hook" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  file {
    content     = "docker compose -f ~/docker-compose.yml exec nginx nginx -s reload"
    destination = "~/certbot-deploy.sh"
  }

  commands = [
    "sudo mv -f ~/certbot-deploy.sh /etc/letsencrypt/renewal-hooks/deploy/nginx-restart.sh",
    "sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-restart.sh"
  ]

  depends_on = [ssh_resource.acquire_certificate]
}
