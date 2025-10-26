resource "tls_private_key" "root" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "server" {
  validity_period_hours = 24 * 365 * 10
  private_key_pem       = tls_private_key.root.private_key_pem
  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
    "cert_signing"
  ]
  is_ca_certificate = true
  subject {
    common_name = "nano-iot"
  }
}

resource "ssh_resource" "dotenv_file" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  pre_commands = ["mkdir -p ~/nano-iot"]

  file {
    content     = <<EOT
APP_MQTT_PORT=8883
APP_MQTT_SERVER_KEY="${tls_self_signed_cert.server.private_key_pem}"
APP_MQTT_SERVER_CERT="${tls_self_signed_cert.server.cert_pem}"
APP_MQTT_ROOT_CERT="${tls_self_signed_cert.server.cert_pem}"
APP_GEMINI_API_KEY=${var.gemini_api_key}
EOT
    destination = "~/nano-iot/.env"
  }

  depends_on = [ssh_resource.create_webadmin_user]
}

resource "ssh_resource" "docker_compose_up" {
  when = "create"

  host                               = hcloud_server.server.ipv4_address
  user                               = "webadmin"
  private_key                        = file(var.ssh_key_path)
  ignore_no_supported_methods_remain = true

  commands = [
    "echo ${var.github_token} | docker login ghcr.io -u USERNAME --password-stdin",
    "docker compose -f ~/docker-compose.yml up -d"
  ]

  depends_on = [ssh_resource.docker_compose_file, ssh_resource.nginx_config_file, ssh_resource.dotenv_file]
}
