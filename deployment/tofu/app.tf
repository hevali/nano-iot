resource "tls_private_key" "root" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "root" {
  # 10 years
  validity_period_hours = 24 * 365 * 10
  private_key_pem       = tls_private_key.root.private_key_pem
  subject {
    common_name = local.hostname
  }
  # digitalSignature, cRLSign, keyCertSign
  allowed_uses = [
    "digital_signature",
    "crl_signing",
    "cert_signing"
  ]
  is_ca_certificate = true
}

resource "random_password" "user_password" {
  length           = 8
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "session_secret" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "ssh_resource" "nginx_config_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/nginx"]

  file {
    content     = templatefile("${path.module}/templates/nginx.conf.tftpl", { hostname : local.hostname })
    destination = "~/nginx/nginx.conf"
  }
}

resource "ssh_resource" "nginx_options_ssl_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/nginx"]

  file {
    content     = file("${path.module}/assets/options-ssl-nginx.conf")
    destination = "~/nginx/options-ssl-nginx.conf"
  }
}

resource "ssh_resource" "nginx_ssl_dhparams_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/nginx"]

  file {
    content     = file("${path.module}/assets/ssl-dhparams.pem")
    destination = "~/nginx/ssl-dhparams.pem"
  }
}

resource "ssh_resource" "dotenv_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/backend"]

  file {
    content     = <<EOT
PORT="3000"
NODE_ENV="production"

APP_BASE_PATH="/api"
APP_TRUST_PROXY="true"
APP_DATA_DIR="/data"
APP_SESSION_SECRET="${random_password.session_secret.result}"
APP_INITIAL_USER="user:${replace(bcrypt(random_password.user_password.result), "$", "\\$")}"

APP_MQTT_PORT="1883"
APP_EXTERNAL_MQTT_PORT="8883"
APP_EXTERNAL_MQTT_HOST="${local.hostname}"
APP_MQTT_SERVER_KEY_PATH="/certs/server.key"
APP_MQTT_SERVER_CERT_PATH="/certs/server.crt"
APP_MQTT_TLS_KEY="${tls_self_signed_cert.root.private_key_pem}"
APP_MQTT_TLS_CERT="${tls_self_signed_cert.root.cert_pem}"

APP_GEMINI_API_KEY="${var.gemini_api_key}"
EOT
    destination = "~/backend/.env"
  }
}

resource "ssh_resource" "docker_compose_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  file {
    content     = templatefile("${path.module}/templates/docker-compose.yml.tftpl", { hostname : local.hostname })
    destination = "~/docker-compose.yml"
  }
}

resource "ssh_resource" "docker_compose_down" {
  triggers = {
    always_run = "${timestamp()}"
  }

  when = "destroy"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  commands = [
    "docker compose -f ~/docker-compose.yml down"
  ]

  depends_on = [ssh_resource.docker_compose_file]
}

resource "ssh_resource" "docker_compose_up" {
  triggers = {
    always_run = "${timestamp()}"
  }

  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = local.server_user
  private_key                        = local.server_ssh_key
  ignore_no_supported_methods_remain = true

  commands = [
    "echo ${var.github_token} | docker login ghcr.io -u USERNAME --password-stdin",
    "docker compose -f ~/docker-compose.yml up -d"
  ]

  depends_on = [
    ssh_resource.docker_compose_file,
    ssh_resource.docker_compose_down,
    ssh_resource.acquire_certificate,
    ssh_resource.dotenv_file,
    ssh_resource.nginx_config_file,
    ssh_resource.nginx_options_ssl_file,
    ssh_resource.nginx_ssl_dhparams_file
  ]
}
