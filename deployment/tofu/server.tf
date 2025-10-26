locals {
  hostname = "${hcloud_zone_rrset.app.name}.${data.hcloud_zone.main.name}"
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
}

resource "hcloud_zone_rrset" "app" {
  zone = data.hcloud_zone.main.name
  name = "app"
  type = "A"

  ttl = 720

  records = [
    { value = hcloud_primary_ip.ip.ip_address },
  ]
}

resource "hcloud_zone_rrset" "www_app" {
  zone = data.hcloud_zone.main.name
  name = "www.app"
  type = "A"

  ttl = 720

  records = [
    { value = hcloud_primary_ip.ip.ip_address },
  ]
}
