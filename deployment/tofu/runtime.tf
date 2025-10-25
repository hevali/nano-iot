resource "random_password" "webadmin_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "ssh_resource" "create_webadmin_user" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "root"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    "adduser webadmin --disabled-password",
    "echo webadmin:${random_password.webadmin_password.result} | chpasswd",
    "usermod -aG sudo webadmin",
    "rsync --archive --chown=webadmin:webadmin ~/.ssh /home/webadmin"
  ]
}

resource "ssh_resource" "update" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    "sudo apt-get update",
    "sudo apt-get upgrade -y"
  ]
}

resource "ssh_resource" "install_docker" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    "sudo apt-get update",
    "sudo apt-get install ca-certificates curl",
    "sudo install -m 0755 -d /etc/apt/keyrings",
    "sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc",
    "sudo chmod a+r /etc/apt/keyrings/docker.asc",
    #
    "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$${UBUNTU_CODENAME:-$VERSION_CODENAME}\") stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
    "sudo apt-get update",
    #
    "sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y"
  ]

  depends_on = [ssh_resource.update]
}

resource "ssh_resource" "install_certbot" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    "sudo apt update",
    "sudo apt install python3 python3-dev python3-venv libaugeas-dev gcc -y",
    "sudo python3 -m venv /opt/certbot/",
    "sudo /opt/certbot/bin/pip install --upgrade pip",
    "sudo /opt/certbot/bin/pip install certbot",
    "sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot",
    # Once updated for new Hetzner DNS API we can use this.
    # "sudo /opt/certbot/bin/pip install certbot-dns-hetzner"
  ]

  depends_on = [ssh_resource.install_docker]
}

# resource "ssh_resource" "dns_hetzner_api_token" {
#   when = "create"

#   host                               = hcloud_server.server.ipv4_address
#   user                               = "webadmin"
#   private_key                        = file(var.ssh_key_path)
#   ignore_no_supported_methods_remain = true

#   file {
#     content     = "dns_hetzner_api_token = ${var.hcloud_token}"
#     destination = "~/credentials.ini"
#   }

#   depends_on = [ssh_resource.install_certbot]
# }

resource "ssh_resource" "acquire_certificate" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    # "certbot certonly --authenticator dns-hetzner --dns-hetzner-credentials ~/credentials.ini --agree-tos -d ${hcloud_zone_rrset.app.name}.${data.hcloud_zone.main.name} -d ${hcloud_zone_rrset.www_app.name}.${data.hcloud_zone.main.name} -n"
    "certbot certonly --standalone --agree-tos -d ${hcloud_zone_rrset.app.name}.${data.hcloud_zone.main.name} -d ${hcloud_zone_rrset.www_app.name}.${data.hcloud_zone.main.name} -n",
    "mkdir -p ~/nginx",
    "curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > \"/etc/letsencrypt/options-ssl-nginx.conf\"",
    "curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > \"/etc/letsencrypt/ssl-dhparams.pem\""
  ]

  depends_on = [ssh_resource.install_certbot]
}

resource "ssh_resource" "docker_compose_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  file {
    content     = file("${path.module}/assets/docker-compose.yml")
    destination = "~/docker-compose.yml"
  }

  depends_on = [ssh_resource.acquire_certificate]
}

resource "ssh_resource" "nginx_config_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  file {
    content     = file("${path.module}/assets/nginx.conf")
    destination = "~/nginx/nginx.conf"
  }

  depends_on = [ssh_resource.acquire_certificate]
}


resource "ssh_resource" "docker_compose_up" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = ["docker compose -f ~/docker-compose.yml up -d"]

  depends_on = [ssh_resource.docker_compose_file, ssh_resource.nginx_config_file]
}
