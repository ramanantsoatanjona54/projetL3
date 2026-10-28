import { Body, Controller, Header, Param, ParseIntPipe, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GenererDocumentDto } from './dto/documents-rh.dto';
import { DocumentsRhService } from './documents-rh.service';

const { ADMIN, DIRECTRICE, COMPTABLE } = RoleUtilisateur;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Documents de ressources humaines : jamais accessibles à un enseignant, un parent ou le secrétariat
@Controller('rh/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(COMPTABLE, ADMIN, DIRECTRICE)
export class DocumentsRhController {
  constructor(private readonly service: DocumentsRhService) {}

  @Post(':personnelId/:modele')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async generer(
    @Param('personnelId', ParseIntPipe) personnelId: number,
    @Param('modele') modele: string,
    @Body() dto: GenererDocumentDto,
    @Req() req: any,
  ): Promise<StreamableFile> {
    const f = await this.service.generer(personnelId, modele, dto, req.user.id as number);
    return new StreamableFile(f.buffer, {
      type: DOCX,
      length: f.buffer.length,
      disposition: `attachment; filename="${f.nomAscii}"; filename*=UTF-8''${encodeURIComponent(f.nom)}`,
    });
  }
}