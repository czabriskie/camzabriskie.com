// Every source a primer cites, defined once (Decision 0007). Primers cite with [@key] in
// markdown; src/lib/remark-citations.mjs turns that into an IEEE-style [n] and appends a
// numbered References section, and /primers/references/ lists everything that's cited.
//
// Only list a source that was actually read while writing, and that supports what it's
// cited for. `accessed` is the date it was last checked.
//
// Fields: authors (array of people, or one organization string), title, container (the
// larger work, italicized: a user guide, a report series), note (plain text after the
// title, like "RFC 1918, IETF"), date, url, accessed (YYYY-MM-DD).

const AWS = 'Amazon Web Services';
const VPC_GUIDE = 'Amazon VPC User Guide';
const CHECKED = '2026-10-05';

const rfc = (n, authors, title, date) => ({
  authors,
  title,
  note: `RFC ${n}, Internet Engineering Task Force`,
  date,
  url: `https://www.rfc-editor.org/rfc/rfc${n}`,
  accessed: CHECKED,
});

const aws = (title, container, url) => ({ authors: AWS, title, container, url, accessed: CHECKED });

export const references = {
  // RFCs
  rfc791: rfc(791, ['J. Postel'], 'Internet Protocol', 'Sep. 1981'),
  rfc1034: rfc(1034, ['P. Mockapetris'], 'Domain names - concepts and facilities', 'Nov. 1987'),
  rfc1918: rfc(1918, ['Y. Rekhter', 'B. Moskowitz', 'D. Karrenberg', 'G. J. de Groot', 'E. Lear'], 'Address Allocation for Private Internets', 'Feb. 1996'),
  rfc3021: rfc(3021, ['A. Retana', 'R. White', 'V. Fuller', 'D. McPherson'], 'Using 31-Bit Prefixes on IPv4 Point-to-Point Links', 'Dec. 2000'),
  rfc3849: rfc(3849, ['G. Huston', 'A. Lord', 'P. Smith'], 'IPv6 Address Prefix Reserved for Documentation', 'Jul. 2004'),
  rfc4291: rfc(4291, ['R. Hinden', 'S. Deering'], 'IP Version 6 Addressing Architecture', 'Feb. 2006'),
  rfc4632: rfc(4632, ['V. Fuller', 'T. Li'], 'Classless Inter-domain Routing (CIDR): The Internet Address Assignment and Aggregation Plan', 'Aug. 2006'),
  rfc5280: rfc(5280, ['D. Cooper', 'S. Santesson', 'S. Farrell', 'S. Boeyen', 'R. Housley', 'W. Polk'], 'Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile', 'May 2008'),
  rfc5737: rfc(5737, ['J. Arkko', 'M. Cotton', 'L. Vegoda'], 'IPv4 Address Blocks Reserved for Documentation', 'Jan. 2010'),
  rfc6066: rfc(6066, ['D. Eastlake 3rd'], 'Transport Layer Security (TLS) Extensions: Extension Definitions', 'Jan. 2011'),
  rfc8200: rfc(8200, ['S. Deering', 'R. Hinden'], 'Internet Protocol, Version 6 (IPv6) Specification', 'Jul. 2017'),
  rfc8446: rfc(8446, ['E. Rescorla'], 'The Transport Layer Security (TLS) Protocol Version 1.3', 'Aug. 2018'),
  rfc8555: rfc(8555, ['R. Barnes', 'J. Hoffman-Andrews', 'D. McCarney', 'J. Kasten'], 'Automatic Certificate Management Environment (ACME)', 'Mar. 2019'),
  rfc8659: rfc(8659, ['P. Hallam-Baker', 'R. Stradling', 'J. Hoffman-Andrews'], 'DNS Certification Authority Authorization (CAA) Resource Record', 'Nov. 2019'),
  rfc9110: rfc(9110, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP Semantics', 'Jun. 2022'),

  // Other standards and announcements
  'nist-sp-800-207': {
    authors: ['S. Rose', 'O. Borchert', 'S. Mitchell', 'S. Connelly'],
    title: 'Zero Trust Architecture',
    note: 'NIST Special Publication 800-207, National Institute of Standards and Technology',
    date: 'Aug. 2020',
    url: 'https://csrc.nist.gov/pubs/sp/800/207/final',
    accessed: CHECKED,
  },
  'nro-ipv4-depleted': {
    authors: 'Number Resource Organization',
    title: 'Free Pool of IPv4 Address Space Depleted',
    date: 'Feb. 3, 2011',
    url: 'https://www.nro.net/ipv4-free-pool-depleted/',
    accessed: CHECKED,
  },

  // Amazon VPC
  'aws-vpc-subnet-sizing': aws('Subnet CIDR blocks', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html'),
  'aws-vpc-cidr-blocks': aws('VPC CIDR blocks', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html'),
  'aws-vpc-subnets': aws('Subnets for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html'),
  'aws-vpc-route-tables': aws('Configure route tables', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html'),
  'aws-vpc-route-priority': aws('How route priority works', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html'),
  'aws-vpc-routing-options': aws('Example routing options', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html'),
  'aws-vpc-nacls': aws('Control subnet traffic with network access control lists', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html'),
  'aws-vpc-default-nacl': aws('Default network ACL for a VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/default-network-acl.html'),
  'aws-vpc-custom-nacl': aws('Custom network ACLs for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html'),
  'aws-vpc-security-groups': aws('Control traffic to your AWS resources using security groups', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html'),
  'aws-vpc-infrastructure-security': aws('Infrastructure security in Amazon VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html'),
  'aws-vpc-quotas': aws('Amazon VPC quotas', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html'),
  'aws-vpc-nat-gateways': aws('NAT gateways', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html'),
  'aws-vpc-regional-nat': aws('Regional NAT gateways for automatic multi-AZ expansion', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateways-regional.html'),
  'aws-vpc-faq': aws('Amazon VPC FAQs', undefined, 'https://aws.amazon.com/vpc/faqs/'),
  'aws-vpc-peering': aws('How VPC peering connections work', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html'),
  'aws-tgw-vpc-attachments': aws('Amazon VPC attachments in AWS Transit Gateway', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/tgw-vpc-attachments.html'),
  'aws-eks-vpc-cni': aws('Assign IPs to Pods with the Amazon VPC CNI', 'Amazon EKS User Guide', 'https://docs.aws.amazon.com/eks/latest/userguide/managing-vpc-cni.html'),

  // Load balancing and WAF
  'aws-nlb-listeners': aws('Listeners for your Network Load Balancers', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-listeners.html'),
  'aws-alb-intro': aws('What is an Application Load Balancer?', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html'),
  'aws-alb-target-groups': aws('Target groups for your Application Load Balancers', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html'),
  'aws-alb-mtls': aws('Mutual authentication with TLS in Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html'),
  'aws-waf-resources': aws('Resources that you can protect with AWS WAF', 'AWS WAF Developer Guide', 'https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html'),

  // Certificates and DNS
  'aws-route53-alias': aws('Choosing between alias and non-alias records', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html'),
  'aws-acm-caa': aws('Certification Authority Authorization (CAA) problems', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html'),
  'aws-acm-exportable': aws('AWS Certificate Manager exportable public certificates', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/acm-exportable-certificates.html'),
  'aws-acm-exportable-blog': {
    authors: AWS,
    title: 'AWS Certificate Manager introduces exportable public SSL/TLS certificates to use anywhere',
    container: 'AWS News Blog',
    url: 'https://aws.amazon.com/blogs/aws/aws-certificate-manager-introduces-exportable-public-ssl-tls-certificates-to-use-anywhere/',
    accessed: CHECKED,
  },
  'aws-acm-dns-renewal': aws('Renewal for domains validated by DNS', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/dns-renewal-validation.html'),
  'aws-acm-pricing': aws('AWS Certificate Manager Pricing', undefined, 'https://aws.amazon.com/certificate-manager/pricing/'),
  'aws-acm-faq': aws('AWS Certificate Manager FAQs', undefined, 'https://aws.amazon.com/certificate-manager/faqs/'),
  'letsencrypt-challenges': { authors: "Let's Encrypt", title: 'Challenge Types', url: 'https://letsencrypt.org/docs/challenge-types/', accessed: CHECKED },
  'caddy-automatic-https': { authors: 'Caddy', title: 'Automatic HTTPS', container: 'Caddy Documentation', url: 'https://caddyserver.com/docs/automatic-https', accessed: CHECKED },
  'mdn-x-forwarded-for': { authors: 'MDN contributors', title: 'X-Forwarded-For header', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For', accessed: CHECKED },
  'python-requests-advanced': { authors: 'Python Software Foundation', title: 'Advanced Usage', container: 'Requests Documentation', url: 'https://requests.readthedocs.io/en/latest/user/advanced/', accessed: CHECKED },
  'python-ipaddress': { authors: 'Python Software Foundation', title: 'ipaddress: IPv4/IPv6 manipulation library', container: 'The Python Standard Library', url: 'https://docs.python.org/3/library/ipaddress.html', accessed: CHECKED },
  'node-cli': { authors: 'OpenJS Foundation', title: 'Command-line API', container: 'Node.js Documentation', url: 'https://nodejs.org/api/cli.html', accessed: CHECKED },
  'java-keytool': { authors: 'Oracle', title: 'The keytool Command', container: 'Java SE 21 Tool Specifications', url: 'https://docs.oracle.com/en/java/javase/21/docs/specs/man/keytool.html', accessed: CHECKED },
  'trino-jdbc': { authors: 'Trino Software Foundation', title: 'JDBC driver', container: 'Trino Documentation', url: 'https://trino.io/docs/current/client/jdbc.html', accessed: CHECKED },
  'openssl-s-client': { authors: 'OpenSSL Project', title: 'openssl-s_client', container: 'OpenSSL Documentation', url: 'https://docs.openssl.org/master/man1/openssl-s_client/', accessed: CHECKED },

  // Reaching private resources
  'aws-s2s-vpn-what-is': aws('What is AWS Site-to-Site VPN?', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html'),
  'aws-s2s-vpn-resilience': aws('Resilience in AWS Site-to-Site VPN', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/disaster-recovery-resiliency.html'),
  'aws-dx-encryption': aws('Establish an AWS VPN using Direct Connect', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/create-vpn-direct-connect'),
  'aws-client-vpn-access': aws('Provide Client VPN users with access to AWS resources', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/client-vpn-give-users-resource-access'),
  'aws-client-vpn-auth-rules': aws('AWS Client VPN authorization rules', 'AWS Client VPN Administrator Guide', 'https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html'),
  'aws-ssm-session-manager': aws('AWS Systems Manager Session Manager', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html'),
  'aws-ssm-start-session': aws('Start a session', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html'),
  'k8s-port-forward': { authors: 'The Kubernetes Authors', title: 'Use Port Forwarding to Access Applications in a Cluster', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/', accessed: CHECKED },
  'socat-manual': { authors: 'G. Rieger', title: 'socat - Multipurpose relay', container: 'socat documentation', url: 'http://www.dest-unreach.org/socat/doc/socat.html', accessed: CHECKED },
};

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
const fmtAccessed = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** IEEE author list: "A", "A and B", "A, B, and C"; more than six becomes "A et al." */
function fmtAuthors(authors) {
  if (typeof authors === 'string') return authors;
  if (authors.length > 6) return `${authors[0]} et al.`;
  if (authors.length <= 2) return authors.join(' and ');
  return `${authors.slice(0, -1).join(', ')}, and ${authors[authors.length - 1]}`;
}

/** One reference in IEEE style, as an HTML string (no surrounding element, no [n]). */
export function formatReference(ref) {
  const after = [];
  if (ref.container) after.push(`<i>${esc(ref.container)}</i>`);
  if (ref.note) after.push(esc(ref.note));
  if (ref.date) after.push(esc(ref.date));
  // IEEE puts the comma (or the period, when nothing follows) inside the quotes.
  // A title ending in its own "?" or "!" takes no extra punctuation.
  const punct = /[?!]$/.test(ref.title) ? '' : after.length ? ',' : '.';
  let out = `${esc(fmtAuthors(ref.authors))}, “${esc(ref.title)}${punct}”`;
  if (after.length) out += ` ${after.join(', ')}.`;
  if (ref.accessed) out += ` Accessed: ${fmtAccessed(ref.accessed)}.`;
  out += ` [Online]. Available: <a href="${esc(ref.url)}">${esc(ref.url)}</a>`;
  return out;
}
