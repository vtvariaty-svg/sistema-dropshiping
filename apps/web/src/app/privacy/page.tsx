import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Política de Privacidade — VTVariaty Dropshipping',
    description: 'Política de Privacidade do sistema VTVariaty Dropshipping Automation.',
};

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[#0a0a0f] text-white/80">
            <div className="max-w-3xl mx-auto px-6 py-16">
                <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
                <p className="text-white/40 text-sm mb-10">Última atualização: 07 de março de 2026</p>

                <div className="space-y-8 text-sm leading-relaxed">
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">1. Introdução</h2>
                        <p>
                            A <strong>VTVariaty</strong> (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Empresa&quot;) opera a plataforma de automação
                            de dropshipping acessível em <strong>dropship-web.onrender.com</strong> (&quot;Plataforma&quot;).
                            Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos
                            as informações dos usuários e dos dados obtidos por meio de integrações com plataformas
                            de terceiros, incluindo <strong>TikTok Shop</strong>, <strong>Shopify</strong> e outros marketplaces.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">2. Dados que Coletamos</h2>
                        <p className="mb-3">Coletamos os seguintes tipos de dados:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Dados de Conta:</strong> e-mail, senha (criptografada com hash), função do usuário (role).</li>
                            <li><strong>Dados de Integrações (TikTok Shop, Shopify):</strong> tokens de acesso (armazenados com criptografia AES-256-GCM), identificadores de loja, dados de pedidos (número, itens, endereço de entrega, valores), dados de produtos e SKUs.</li>
                            <li><strong>Dados Operacionais:</strong> logs de webhooks, logs de sincronização, eventos de pedidos, registros de ordens de compra.</li>
                            <li><strong>Dados Técnicos:</strong> endereço IP, user-agent, timestamps de acesso para fins de segurança e auditoria.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">3. Como Usamos os Dados</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Processar e gerenciar pedidos importados das plataformas conectadas (TikTok Shop, Shopify).</li>
                            <li>Sincronizar dados de produtos, estoque e fulfillment entre as plataformas.</li>
                            <li>Calcular margens de lucro e gerar relatórios analíticos para o lojista.</li>
                            <li>Gerenciar o fluxo operacional de compras com fornecedores.</li>
                            <li>Manter a segurança e integridade da Plataforma.</li>
                            <li>Cumprir obrigações legais aplicáveis.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">4. Integrações com Terceiros</h2>
                        <p className="mb-3">
                            Nossa Plataforma se integra com as seguintes plataformas por meio de suas APIs oficiais:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>TikTok Shop:</strong> utilizamos a TikTok Shop Open API para importar pedidos, consultar informações de lojas e receber notificações via webhooks. Os tokens de acesso são armazenados com criptografia AES-256-GCM e nunca são registrados em logs.</li>
                            <li><strong>Shopify:</strong> utilizamos a Shopify Admin API para sincronizar pedidos, produtos e fulfillment.</li>
                        </ul>
                        <p className="mt-3">
                            Acessamos apenas os dados estritamente necessários para o funcionamento das funcionalidades contratadas pelo usuário. Não vendemos, compartilhamos ou transferimos dados a terceiros além do necessário para a operação do serviço.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">5. Armazenamento e Segurança</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Todos os dados são armazenados em banco de dados PostgreSQL hospedado em infraestrutura segura (Neon) com conexão criptografada (SSL/TLS).</li>
                            <li>Tokens de acesso de terceiros são criptografados em repouso usando AES-256-GCM com chave gerenciada em variáveis de ambiente seguras.</li>
                            <li>Senhas de usuários são armazenadas com hash bcrypt e nunca em texto plano.</li>
                            <li>A comunicação entre cliente e servidor é protegida por HTTPS.</li>
                            <li>Utilizamos isolamento multi-tenant rigoroso: cada lojista acessa apenas seus próprios dados.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">6. Retenção de Dados</h2>
                        <p>
                            Mantemos os dados pelo tempo necessário para fornecer o serviço e cumprir obrigações legais.
                            Dados de webhooks e logs de sincronização são retidos para fins de auditoria e solução de problemas.
                            O usuário pode solicitar a exclusão de sua conta e dados a qualquer momento entrando em contato conosco.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">7. Direitos do Usuário</h2>
                        <p className="mb-3">Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Acessar os dados pessoais que coletamos sobre você.</li>
                            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
                            <li>Solicitar a exclusão ou anonimização de dados pessoais.</li>
                            <li>Revogar o consentimento para integrações a qualquer momento.</li>
                            <li>Solicitar a portabilidade de seus dados.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">8. Cookies</h2>
                        <p>
                            Utilizamos cookies apenas para fins de autenticação (tokens JWT) e manutenção de sessão.
                            Não utilizamos cookies de rastreamento publicitário ou de terceiros para fins de marketing.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">9. Alterações nesta Política</h2>
                        <p>
                            Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas
                            serão comunicadas por meio da Plataforma. O uso continuado após a publicação de alterações
                            constitui aceitação da política atualizada.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">10. Contato</h2>
                        <p>
                            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
                        </p>
                        <ul className="list-none mt-3 space-y-1">
                            <li>📧 <strong>E-mail:</strong> vtvariaty@gmail.com</li>
                            <li>🏢 <strong>Empresa:</strong> VTVariaty</li>
                        </ul>
                    </section>
                </div>

                <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-xs">
                    © {new Date().getFullYear()} VTVariaty. Todos os direitos reservados.
                </div>
            </div>
        </main>
    );
}
