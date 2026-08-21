import type { NextConfig } from "next";

// `serverExternalPackages` marcava o ffmpeg como externo para as rotas de API que
// transcodificavam áudio do WhatsApp. Não há rota de API neste projeto.
const nextConfig: NextConfig = {};

export default nextConfig;
